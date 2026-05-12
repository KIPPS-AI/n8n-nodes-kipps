import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
	INodePropertyOptions,
	ResourceMapperFields,
	NodeConnectionType,
	NodeApiError,
	NodeOperationError,
	JsonObject,
} from 'n8n-workflow';

// ─── WhatsApp Template Cache ──────────────────────────────────────────────────

const TEMPLATES_CACHE_TTL_MS = 5 * 60 * 1000;
type KippsApiCredentials = { bearerToken?: string; organizationId?: string };
type TemplatesCache = Map<string, { data: unknown[]; ts: number }>;

async function getTemplatesCached(
	cache: TemplatesCache,
	cacheKey: string,
	fetchFn: () => Promise<unknown[]>,
): Promise<unknown[]> {
	const now = Date.now();
	const entry = cache.get(cacheKey);
	if (entry && now - entry.ts < TEMPLATES_CACHE_TTL_MS) return entry.data;
	const data = await fetchFn();
	cache.set(cacheKey, { data, ts: now });
	return data;
}

function getTemplatesCacheKey(creds: KippsApiCredentials | undefined, agentUuid?: string): string {
	return `${creds?.organizationId ?? ''}:${creds?.bearerToken ?? ''}:${agentUuid ?? ''}`;
}

// ─── Node Class ───────────────────────────────────────────────────────────────

export class KippsAi implements INodeType {
	usableAsTool = true;

	methods = (() => {
		const templatesCacheUi: TemplatesCache = new Map();

		async function fetchApprovedTemplates(
			ctx: ILoadOptionsFunctions,
			cache: TemplatesCache,
		): Promise<Array<{ name?: string; components?: unknown; status?: string }>> {
			const creds = (await ctx.getCredentials('kippsAiApi')) as KippsApiCredentials | undefined;
			const agentUuid = ctx.getCurrentNodeParameter('whatsappAgentUuid') as string;
			const cacheKey = getTemplatesCacheKey(creds, agentUuid);
			return (await getTemplatesCached(cache, cacheKey, async () => {
				const res = await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'kippsAiApi', {
					method: 'GET',
					url: `https://backend.kipps.ai/integrations/get-whatsapp-templates/?whatsapp_agent_id=${agentUuid}`,
				});
				const list = Array.isArray(res) ? res : [];
				return list.filter((t) => (t as { status?: string }).status === 'APPROVED');
			})) as Array<{ name?: string; components?: unknown; status?: string }>;
		}

		return {
			loadOptions: {
				async getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
					const templates = await fetchApprovedTemplates(this, templatesCacheUi);
					return templates.map((t) => ({
						name: String(t.name),
						value: String(t.name),
					}));
				},

				async getTemplateComponentsPreview(
					this: ILoadOptionsFunctions,
				): Promise<INodePropertyOptions[]> {
					const templateName = this.getCurrentNodeParameter('templateName') as string;
					if (!templateName) {
						return [
							{ name: 'Select a Template Above to See Its Components.', value: 'no_template' },
						];
					}

					let templates: Array<{ name?: string; components?: unknown }>;
					try {
						templates = await fetchApprovedTemplates(this, templatesCacheUi);
					} catch {
						return [
							{
								name: 'The Selected Template Could Not Be Read. Please Select It Again.',
								value: 'invalid_template',
							},
						];
					}

					const template = templates.find((t) => String(t.name) === templateName);
					if (!template) {
						return [
							{
								name: 'The Selected Template Could Not Be Found. Please Select It Again.',
								value: 'template_not_found',
							},
						];
					}

					const components = Array.isArray(template.components) ? template.components : [];
					if (!components.length) {
						return [{ name: 'This Template Has No Components.', value: 'no_components' }];
					}

					const options: INodePropertyOptions[] = [];
					components.forEach(
						(
							c: {
								type?: string;
								text?: string;
								format?: string;
								buttons?: Array<{ text?: string }>;
							},
							index: number,
						) => {
							const type = c?.type ?? 'UNKNOWN';
							if (type === 'BODY') {
								const text: string = c.text ?? '';
								const short = text.length > 100 ? `${text.slice(0, 97)}…` : text;
								options.push({
									name: `${index + 1}. BODY – ${short || 'No body text'}`,
									value: `BODY_${index}`,
								});
							} else if (type === 'HEADER') {
								const format = c?.format ?? 'TEXT';
								const text: string = c.text ?? '';
								const short = text.length > 80 ? `${text.slice(0, 77)}…` : text;
								options.push({
									name: `${index + 1}. HEADER (${format})${short ? ` – ${short}` : ''}`,
									value: `HEADER_${index}`,
								});
							} else if (type === 'BUTTONS') {
								const buttons = Array.isArray(c.buttons) ? c.buttons : [];
								const labels = buttons
									.map((b) => b.text)
									.filter((t): t is string => !!t)
									.join(', ');
								options.push({
									name: `${index + 1}. BUTTONS – ${labels || 'No button labels'}`,
									value: `BUTTONS_${index}`,
								});
							} else {
								options.push({ name: `${index + 1}. ${type}`, value: `${type}_${index}` });
							}
						},
					);
					return options;
				},
			},

			resourceMapping: {
				async getTemplateFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
					const templateName = this.getCurrentNodeParameter('templateName') as string;
					if (!templateName) return { fields: [] };

					type WaTemplate = {
						name?: string;
						parameter_format?: string;
						components?: Array<{
							type?: string;
							text?: string;
							example?: {
								body_text_named_params?: Array<{ param_name?: string; example?: string }>;
								body_text?: string[][];
							};
						}>;
					};

					let template: WaTemplate | undefined;
					try {
						const templates = await fetchApprovedTemplates(this, templatesCacheUi);
						template = (templates as WaTemplate[]).find((t) => String(t?.name) === templateName);
					} catch {
						return { fields: [] };
					}

					if (!template) return { fields: [] };

					const body = template.components?.find((c) => c.type === 'BODY') as
						| {
								text?: string;
								example?: {
									body_text_named_params?: Array<{ param_name?: string; example?: string }>;
									body_text?: string[][];
								};
						  }
						| undefined;

					if (!body) return { fields: [] };

					const fields: ResourceMapperFields['fields'] = [];

					if (template.parameter_format === 'NAMED') {
						const named = body.example?.body_text_named_params || [];
						for (const p of named) {
							if (!p?.param_name) continue;
							fields.push({
								id: String(p.param_name),
								displayName: p.example ? `${p.param_name} (e.g., "${p.example}")` : p.param_name,
								defaultMatch: false,
								canBeUsedToMatch: false,
								required: true,
								display: true,
								type: 'string',
							});
						}
					} else {
						const examples: string[] = body.example?.body_text?.[0] || [];
						let paramCount = 0;
						if (examples.length > 0) {
							paramCount = examples.length;
						} else {
							const bodyText = body.text || '';
							const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
							if (matches.length > 0) {
								paramCount = Math.max(
									...matches.map((m: string) => parseInt(m.match(/\d+/)?.[0] ?? '0')),
								);
							}
						}

						for (let idx = 0; idx < paramCount; idx++) {
							const exampleVal = examples[idx] || '';
							fields.push({
								id: `param_${idx}`,
								displayName: exampleVal
									? `Parameter ${idx + 1} (e.g., "${exampleVal}")`
									: `Parameter ${idx + 1}`,
								defaultMatch: false,
								canBeUsedToMatch: false,
								required: true,
								display: true,
								type: 'string',
							});
						}
					}

					if (fields.length === 0) {
						return {
							fields: [],
							emptyFieldsNotice:
								'This template has no parameters to fill. The message will be sent as-is.',
						};
					}

					return { fields };
				},
			},
		};
	})();

	description: INodeTypeDescription = {
		displayName: 'Kipps.AI',
		name: 'kippsAi',
		icon: { light: 'file:kipps-light.png', dark: 'file:kipps-dark.png' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["agentType"]}}',
		description: 'Interact with Kipps.AI — Chatbot, Voice Agent, or WhatsApp',
		defaults: { name: 'Kipps.AI' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'kippsAiApi', required: true }],

		properties: [
			// ── Agent Type Selector ────────────────────────────────────────────
			{
				displayName: 'Agent Type',
				name: 'agentType',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chatbot',
						value: 'chatbot',
						description: 'Send and receive messages with a Kipps.AI chatbot',
					},
					{
						name: 'Voice Agent',
						value: 'voiceAgent',
						description: 'Start an outbound phone call using a Kipps.AI voice agent',
					},
					{
						name: 'WhatsApp',
						value: 'whatsapp',
						description: 'Send a WhatsApp template message via Kipps.AI',
					},
				],
				default: 'chatbot',
			},

			// ── CHATBOT fields ─────────────────────────────────────────────────
			{
				displayName: 'Agent ID',
				name: 'agentId',
				type: 'string',
				default: '',
				placeholder: 'chatbot-123',
				description: 'The ID of the chatbot agent to use',
				required: true,
				displayOptions: { show: { agentType: ['chatbot'] } },
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				placeholder: 'Hello, tell me about your features.',
				description: 'The message to send to the chatbot',
				required: true,
				displayOptions: { show: { agentType: ['chatbot'] } },
			},
			{
				displayName: 'Session ID',
				name: 'session',
				type: 'string',
				default: '',
				placeholder: 'optional-session-ID',
				description:
					'Optional ID to maintain conversation context. Leave empty to create a new session.',
				displayOptions: { show: { agentType: ['chatbot'] } },
			},

			// ── VOICE AGENT fields ─────────────────────────────────────────────
			{
				displayName: 'Voicebot ID',
				name: 'voicebotId',
				type: 'string',
				default: '',
				placeholder: 'example-voicebot-id',
				description: 'ID of the Kipps.AI voicebot used to start the call',
				required: true,
				displayOptions: { show: { agentType: ['voiceAgent'] } },
			},
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				default: '',
				placeholder: '+911234567890',
				description: 'Destination phone number in E.164 format',
				required: true,
				displayOptions: { show: { agentType: ['voiceAgent'] } },
			},
			{
				displayName: 'Room Name',
				name: 'roomName',
				type: 'string',
				default: '',
				placeholder: 'call-123',
				description: 'Unique room name for the phone call session',
				required: true,
				displayOptions: { show: { agentType: ['voiceAgent'] } },
			},

			// ── WHATSAPP fields ────────────────────────────────────────────────
			{
				displayName: 'WhatsApp Agent UUID',
				name: 'whatsappAgentUuid',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'a5xxxxx-2cb0-xxx-xxxxxxxxxxx',
				description: 'WhatsApp agent UUID used to fetch templates',
				displayOptions: { show: { agentType: ['whatsapp'] } },
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: '+1234567890',
				description: 'Recipient WhatsApp number in international format (e.g. +1234567890)',
				displayOptions: { show: { agentType: ['whatsapp'] } },
			},
			{
				displayName: 'Template Name or ID',
				name: 'templateName',
				type: 'options',
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsDependsOn: ['whatsappAgentUuid'],
					loadOptionsMethod: 'getTemplates',
				},
				displayOptions: { show: { agentType: ['whatsapp'] } },
			},
			{
				displayName: 'Template Components Preview',
				name: 'templateComponentsPreview',
				type: 'options',
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsDependsOn: ['whatsappAgentUuid', 'templateName'],
					loadOptionsMethod: 'getTemplateComponentsPreview',
				},
				displayOptions: { show: { agentType: ['whatsapp'] } },
			},
			{
				displayName: 'Parameters',
				name: 'mappedParameters',
				type: 'resourceMapper',
				noDataExpression: true,
				default: { mappingMode: 'defineBelow', value: {} },
				required: true,
				description:
					'Enter values for template parameters. Fields appear automatically after selecting a template. If they do not appear, click ⋮ → "Refresh fields".',
				typeOptions: {
					loadOptionsDependsOn: ['whatsappAgentUuid', 'templateName'],
					resourceMapper: {
						mode: 'map',
						resourceMapperMethod: 'getTemplateFields',
						supportAutoMap: false,
					},
				},
				displayOptions: { show: { agentType: ['whatsapp'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { agentType: ['whatsapp'] } },
				options: [
					{
						displayName: 'Conversation ID',
						name: 'conversation_id',
						type: 'string',
						default: '',
						description: 'Optional Conversation ID to associate with the message',
					},
				],
			},
		],
	};

	// ── Execute ────────────────────────────────────────────────────────────────

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const agentType = this.getNodeParameter('agentType', 0) as string;
		const headers = { 'Content-Type': 'application/json' };

		// Pre-fetch WhatsApp templates once for the whole execution run
		const templatesCacheRun: TemplatesCache = new Map();
		let whatsappTemplates: unknown[] = [];

		if (agentType === 'whatsapp') {
			const creds = (await this.getCredentials('kippsAiApi')) as KippsApiCredentials | undefined;
			const agentUuid = this.getNodeParameter('whatsappAgentUuid', 0) as string;
			const cacheKey = getTemplatesCacheKey(creds, agentUuid);
			try {
				whatsappTemplates = await getTemplatesCached(templatesCacheRun, cacheKey, async () => {
					const res = await this.helpers.httpRequestWithAuthentication.call(this, 'kippsAiApi', {
						method: 'GET',
						url: `https://backend.kipps.ai/integrations/get-whatsapp-templates/?whatsapp_agent_id=${agentUuid}`,
					});
					const list = Array.isArray(res) ? res : [];
					return list.filter((t) => (t as { status?: string }).status === 'APPROVED');
				});
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as JsonObject, {
					message: 'Could not load WhatsApp templates. Please check your credentials.',
				});
			}
		}

		for (let i = 0; i < items.length; i++) {
			try {
				// ── CHATBOT ────────────────────────────────────────────────────
				if (agentType === 'chatbot') {
					const agentId = this.getNodeParameter('agentId', i, '') as string;
					const message = this.getNodeParameter('message', i, '') as string;
					let session = this.getNodeParameter('session', i, '') as string;

					if (!session) {
						const convRes = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'kippsAiApi',
							{
								method: 'POST' as IHttpRequestMethods,
								url: 'https://backend.kipps.ai/v2/kipps/conversation/',
								body: { chatbot_id: agentId },
								headers,
							},
						);
						session = convRes.id || convRes.data?.id;
					}

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'kippsAiApi',
						{
							method: 'POST' as IHttpRequestMethods,
							url: 'https://backend.kipps.ai/v2/kipps/reply/',
							body: { message, chatbot_id: agentId, conversation_id: session },
							headers,
						},
					);

					returnData.push({ json: response, pairedItem: i });
				}

				// ── VOICE AGENT ────────────────────────────────────────────────
				else if (agentType === 'voiceAgent') {
					const voicebotId = this.getNodeParameter('voicebotId', i, '') as string;
					const phoneNumber = this.getNodeParameter('phoneNumber', i, '') as string;
					const roomName = this.getNodeParameter('roomName', i, '') as string;

					const body = {
						voicebot: voicebotId,
						to_phone_number: phoneNumber,
						room_name: roomName,
						call_origin: 'outbound',
						call_end_status: 'started',
					};

					this.logger.debug(`KippsAI VoiceAgent request body: ${JSON.stringify(body)}`);

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'kippsAiApi',
						{
							method: 'POST' as IHttpRequestMethods,
							url: 'https://backend.kipps.ai/speech/phone-call/',
							body,
							headers,
						},
					);

					this.logger.debug(`KippsAI VoiceAgent response: ${JSON.stringify(response)}`);
					returnData.push({ json: { response }, pairedItem: i });
				}

				// ── WHATSAPP ───────────────────────────────────────────────────
				else if (agentType === 'whatsapp') {
					const to = this.getNodeParameter('to', i) as string;
					const templateName = this.getNodeParameter('templateName', i) as string;

					type WaTemplate = {
						name?: string;
						parameter_format?: string;
						components?: Array<{
							type?: string;
							text?: string;
							example?: {
								body_text_named_params?: Array<{ param_name?: string }>;
								body_text?: string[][];
							};
						}>;
					};

					const template = (whatsappTemplates as WaTemplate[]).find(
						(t) => String(t.name) === templateName,
					);

					if (!template) {
						throw new NodeOperationError(
							this.getNode(),
							`Selected template "${templateName}" was not found. Please re-select a template.`,
							{ itemIndex: i },
						);
					}

					const mapped = this.getNodeParameter('mappedParameters', i) as {
						value: Record<string, unknown>;
					};
					const values = mapped?.value || {};

					const empty = Object.entries(values)
						.filter(([, v]) => v === undefined || v === null || v === '')
						.map(([k]) => k);

					if (empty.length) {
						throw new NodeOperationError(
							this.getNode(),
							`Required parameter fields are empty: ${empty.join(', ')}`,
							{ itemIndex: i },
						);
					}

					let parameters: { body: Array<{ name: string; value: string }> } | { body: string[] };

					if (template.parameter_format === 'NAMED') {
						const bodyComp = template.components?.find((c) => c.type === 'BODY');
						const namedParams = bodyComp?.example?.body_text_named_params || [];
						parameters = {
							body: namedParams.map((p) => ({
								name: p.param_name ?? '',
								value: String(values[p.param_name ?? ''] ?? ''),
							})),
						};
					} else {
						parameters = {
							body: Object.keys(values)
								.sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]))
								.map((k) => String(values[k] ?? '')),
						};
					}

					const additionalFields = this.getNodeParameter('additionalFields', i) as {
						agent_uuid?: string;
						conversation_id?: string;
					};

					const requestBody: Record<string, unknown> = {
						to,
						template_name: template.name ?? '',
						template_components: template.components || [],
						parameters,
					};
					if (additionalFields.agent_uuid) requestBody.agent_uuid = additionalFields.agent_uuid;
					if (additionalFields.conversation_id)
						requestBody.conversation_id = additionalFields.conversation_id;

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'kippsAiApi',
						{
							method: 'POST' as IHttpRequestMethods,
							url: 'https://backend.kipps.ai/integrations/whatsapp-agent/send-template/',
							body: requestBody,
							headers,
						},
					);

					returnData.push({ json: response, pairedItem: i });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return this.prepareOutputData(returnData);
	}
}

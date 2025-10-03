import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

export class KippsAiChatbot implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kipps.AI Chatbot',
		name: 'kippsAiChatbot',
		icon: { light: 'file:../chat-light.svg', dark: 'file:../chat-dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Interact with a Kipps.AI Chatbot to send and receive messages.',
		defaults: {
			name: 'Kipps.AI Chatbot',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'kippsAiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Agent ID',
				name: 'agentId',
				type: 'string',
				default: '',
				placeholder: 'chatbot-123',
				description: 'The ID of the chatbot agent to use',
				required: true,
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				placeholder: 'Hello, tell me about your features.',
				description: 'The message to send to the chatbot',
				required: true,
			},
			{
				displayName: 'Session ID',
				name: 'session',
				type: 'string',
				default: '',
				placeholder: 'optional-session-ID',
				description: 'An optional ID to maintain conversation context. If left empty, a new session will be created.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			let body: { [key: string]: any } = {};
			const headers = { 'Content-Type': 'application/json' };
			try {
				const agentId = this.getNodeParameter('agentId', itemIndex, '') as string;
				const message = this.getNodeParameter('message', itemIndex, '') as string;
				let session = this.getNodeParameter('session', itemIndex, '') as string;

				if (!session) {
					const convRes = await this.helpers.httpRequestWithAuthentication.call(this, 'kippsAiApi', {
						method: 'POST',
						url: 'https://backend.kipps.ai/v2/kipps/conversation/',
						body: { chatbot_id: agentId },
						headers,
					});
					session = convRes.id || convRes.data?.id;
				}

				body = {
					message,
					chatbot_id: agentId,
					conversation_id: session,
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'kippsAiApi', {
					method: 'POST',
					url: 'https://backend.kipps.ai/v2/kipps/reply/',
					body,
					headers,
				});

				returnData.push({ json: response, pairedItem: itemIndex });

		   } catch (error) {
			   if (this.continueOnFail()) {
				   returnData.push({ json: { error: error.message, errorDetails: error }, pairedItem: itemIndex });
			   } else {
				   throw new NodeOperationError(this.getNode(), error);
			   }
		   }
		}

		return this.prepareOutputData(returnData);
	}
}

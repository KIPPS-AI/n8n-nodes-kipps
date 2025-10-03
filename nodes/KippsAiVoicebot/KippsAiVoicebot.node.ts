import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
	IHttpRequestMethods,
} from 'n8n-workflow';

export class KippsAiVoicebot implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kipps.AI Voicebot',
		name: 'kippsAiVoicebot',
		icon: { light: 'file:../microphone-light.svg', dark: 'file:../microphone-dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Manage and interact with a Kipps.AI Voicebot for handling calls.',
		defaults: {
			name: 'Kipps.AI Voicebot',
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
				displayName: 'Action',
				name: 'action',
				type: 'options',
				options: [
					{
						name: 'Start Call',
						value: 'startCall',
					},
					{
						name: 'Send Audio/Text',
						value: 'sendAudioText',
					},
					{
						name: 'End Call',
						value: 'endCall',
					},
				],
				default: 'startCall',

			},
			{
				displayName: 'Voicebot ID',
				name: 'voicebotId',
				type: 'string',
				default: '',
				placeholder: 'voicebot-456',
				description: 'The ID of the voicebot to use',
				required: true,
			},
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				default: '',
				placeholder: '+1234567890',
				description: 'The destination phone number for the call',
				required: true,
				displayOptions: {
					show: {
						action: ['startCall'],
					},
				},
			},
			{
				displayName: 'Room Name',
				name: 'roomName',
				type: 'string',
				default: '',
				placeholder: 'call-123',
				description: 'A unique name for the call room to perform actions in',
				required: true,
				displayOptions: {
					show: {
						action: ['startCall', 'sendAudioText', 'endCall'],
					},
				},
			},
			{
				displayName: 'Input Type',
				name: 'inputType',
				type: 'options',
				options: [
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'Audio',
						value: 'audio',
					},
				],
				default: 'text',
				description: 'The type of input you want to send to the voicebot',
				displayOptions: {
					show: {
						action: ['sendAudioText'],
					},
				},
			},
			{
				displayName: 'Text Input',
				name: 'textInput',
				type: 'string',
				default: '',
				description: 'The text message to send to the voicebot',
				displayOptions: {
					show: {
						inputType: ['text'],
						action: ['sendAudioText'],
					},
				},
			},
			{
				displayName: 'Audio Input',
				name: 'audioInput',
				type: 'string',
				default: '',
				description: 'The path or URL to the audio file to be sent',
				displayOptions: {
					show: {
						inputType: ['audio'],
						action: ['sendAudioText'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const action = this.getNodeParameter('action', itemIndex, '') as string;
				const voicebotId = this.getNodeParameter('voicebotId', itemIndex, '') as string;

				let endpoint = '';
				let method: IHttpRequestMethods = 'POST';
				let body: { [key: string]: any } = {};

				switch (action) {
					case 'startCall': {
						endpoint = 'https://backend.kipps.ai/speech/phone-call/';
						const phoneNumber = this.getNodeParameter('phoneNumber', itemIndex, '') as string;
						if (!phoneNumber || phoneNumber.trim() === '') {
							throw new NodeOperationError(
								this.getNode(),
								'Phone Number is required for starting a call.',
							);
						}
						body.voicebot = voicebotId;
						body.phone_number = phoneNumber;
						body.room_name = this.getNodeParameter('roomName', itemIndex, '') as string;
						body.call_origin = 'outbound';
						body.call_status = 'ringing';
						break;
					}
					case 'sendAudioText': {
						endpoint = 'https://backend.kipps.ai/speech/web-call/';
						body.voicebot = voicebotId;
						body.room_name = this.getNodeParameter('roomName', itemIndex, '') as string;
						body.call_origin = 'test-call';
						body.caller_id = 'unknown_web_user';
						body.caller_name = 'unknown_web_user';
						const inputType = this.getNodeParameter('inputType', itemIndex, '') as string;
						if (inputType === 'text') {
							body.text = this.getNodeParameter('textInput', itemIndex, '') as string;
						} else {
							body.audio = this.getNodeParameter('audioInput', itemIndex, '') as string;
						}
						break;
					}
					case 'endCall': {
						const roomName = this.getNodeParameter('roomName', itemIndex, '') as string;
						endpoint = `https://backend.kipps.ai/speech/phone-call/${roomName}/`;
						method = 'PATCH';
						body.call_status = 'completed';
						break;
					}
				}

				const headers = { 'Content-Type': 'application/json' };
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'kippsAiApi', {
					method,
					url: endpoint,
					body,
					headers,
				});

				returnData.push({ json: { response, debug: { body, headers, endpoint, method } }, pairedItem: itemIndex });
			} catch (error) {
				let debugInfo: any = { error: error.message, errorDetails: error };
				if (error.response) {
					debugInfo.apiResponse = {
						status: error.response.status,
						statusText: error.response.statusText,
						data: error.response.data,
						headers: error.response.headers,
					};
				}
				if (this.continueOnFail()) {
					returnData.push({
						json: debugInfo,
						pairedItem: itemIndex,
					});
				} else {
					throw new NodeOperationError(this.getNode(), debugInfo);
				}
			}
		}

		return this.prepareOutputData(returnData);
	}
}

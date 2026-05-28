import {
	ICredentialType,
	INodeProperties,
	IAuthenticateGeneric,
	ICredentialTestRequest,
} from 'n8n-workflow';

export class KippsAiApi implements ICredentialType {
	name = 'kippsAiApi';
	displayName = 'Kipps.AI API';
	documentationUrl = 'https://docs.kipps.ai/docs/v1.2.2/developer-api';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'Your API Key',
			description: 'The API key for your Kipps.AI account.',
		},

		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://backend.kipps.ai',
			placeholder: 'http://host.docker.internal:8000',
			description: 'Kipps backend base URL',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Api-Key {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl || "https://backend.kipps.ai"}}',
			url: '/kipps/agents/',
			method: 'GET',
		},
	};
}

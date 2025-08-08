
import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
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
			placeholder: 'Your API ID',
			description: 'The API ID for your Kipps.AI account',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Authorization': '=Bearer {{$credentials.apiKey}}',
			},
		},
	};
}

import { createAgent } from '@flue/runtime';

export default createAgent(() => ({
	model: 'anthropic/claude-sonnet-4-6',
	instructions: 'Tell a funny "hello world" engineering joke.',
}));


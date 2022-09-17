import type {StorybookViteConfig} from '@storybook/builder-vite';

const config: StorybookViteConfig = {
    "core": {
        "builder": "@storybook/builder-vite"
    },
    "stories": [
        "./stories/**/*.stories.mdx",
        "./stories/**/*.stories.@(js|jsx|ts|tsx)",
        "./stories/index.tsx"
    ],
    "addons": [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@storybook/addon-storysource",
    ],
    "framework": "@storybook/react",
    async viteFinal(config, options) {
        //config.base = '/storybook/';
        return config;
    },
}

export default config
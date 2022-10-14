import type {StorybookConfig} from '@storybook/builder-vite';

const config: StorybookConfig = {
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
    "framework": '@storybook/react-vite',

    async viteFinal(config, options) {
        //config.base = '/storybook/';
        return config;
    },
    staticDirs: ['./public'],
}

export default config
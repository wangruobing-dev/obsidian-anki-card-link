import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'word-export-runtime.cjs',
		'word-export-runtime.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'vitest.config.mts',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['src/platform/export-word.ts'],
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
			'obsidianmd/no-nodejs-modules': 'off',
		},
	},
	{
		files: ['tests/feishu-platform.test.ts'],
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
		},
	},
);

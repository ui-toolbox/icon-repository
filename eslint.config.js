import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import pluginReact from "eslint-plugin-react";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import stylistic from "@stylistic/eslint-plugin";

export default [
	{
		languageOptions: {
			globals: globals.jasmine
		}
	},
	{
		ignores: ["package-lock.json", "**/node_modules/**", "**/dist/**", "**/build/**"]
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		languageOptions: { globals: globals.node }
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		...js.configs.recommended
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		languageOptions: { globals: globals.browser }
	},
	...tseslint.configs.recommended.map(config => ({
		...config,
		files: ["**/*.{ts,tsx,mts,cts}"]
	})),
	{
		files: ["**/*.{jsx,tsx}"],
		...pluginReact.configs.flat.recommended
	},
	{
		...json.configs.recommended,
		files: ["**/*.json"],
		ignores: ["tsconfig.json"],
		language: "json/json"
	},
	...markdown.configs.recommended,
	{
		files: ["**/*.css"],
		...css.configs.recommended
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		plugins: {
			"@stylistic": stylistic
		}
	},
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		rules: {
			"@stylistic/indent": ["error", "tab"],
			"@stylistic/quotes": ["error", "double"],
			"@stylistic/semi": ["error", "always"],
			"@stylistic/comma-dangle": ["error"],
			"@stylistic/member-delimiter-style": ["error", {
				multiline: {
					delimiter: "semi",
					requireLast: true
				},
				singleline: {
					delimiter: "semi",
					requireLast: false
				}
			}],
			"no-undef": "off"
		}
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": ["error", {
				"argsIgnorePattern": "^_",
				"varsIgnorePattern": "^_",
				"caughtErrorsIgnorePattern": "^_"
			}]
		},
		languageOptions: {
			parser: tsparser
		},
		plugins: {
			"@typescript-eslint": tseslintPlugin
		}
	}
];

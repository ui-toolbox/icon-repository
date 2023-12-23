module.exports = {
	env: {
		browser: true,
		es2021: true
	},
	extends: [
		"standard-with-typescript",
	],
	overrides: [
		{
			env: {
				node: true
			},
			files: [
				".eslintrc.{js,cjs}"
			],
			parserOptions: {
				sourceType: "script"
			}
		}
	],
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
		parser: "@typescript-eslint/parser",
		project: "./tsconfig.json"
	},
	plugins: [
		"node"
	],
	rules: {
		quotes: ["error", "double"],
		semi: ["error", "always"],
		"no-tabs": 0,
		indent: ["error", "tab", { "SwitchCase": 1 }],
		"@typescript-eslint/quotes": ["error", "double"],
		"@typescript-eslint/semi": ["error", "always"],
		"@typescript-eslint/indent": ["error", "tab"],
		"space-before-function-paren": "off",
		"@typescript-eslint/space-before-function-paren": "error"
	},
	settings: {
		node: {
			version: "detect"
		}
	},
	"ignorePatterns": [".eslintrc.js"],
};

import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import pluginPromise from 'eslint-plugin-promise'

export default [
	{ ignores: [ 'eslint.config.js' ] },
	{
		plugins	: {
			'@typescript-eslint'	: tsPlugin
		,	promise					: pluginPromise
		}
	,	languageOptions: {
			globals		: globals.browser
		,	parser		: tsParser
		,	parserOptions: {
				project				: './jsconfig.json'
			,	tsconfigRootDir		: import.meta.dirname
			}
		}
	,	rules: {
			'@typescript-eslint/no-floating-promises'	: 'error'
		,	'promise/catch-or-return'					: 'error'
		}
	}
]

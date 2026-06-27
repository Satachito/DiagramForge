#!/usr/bin/env node
//	DiagramForge MCP server — natural-language agents control the live diagram via df-server.
//
//	Prerequisites:
//	  cd Web && npm run dev          ( df-server on :8080 )
//	  open http://localhost:8080/?cde=Samples/JSONs.cde
//
//	Cursor MCP config ( .cursor/mcp.json ):
//	  { "mcpServers": { "diagramforge": { "command": "node", "args": ["tools/df-mcp.mjs"] } } }

import { McpServer	} from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport	} from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFile, writeFile	} from 'node:fs/promises'
import { z	} from 'zod'
import { dfStatus, dfGetModel, dfRpc	} from './df-client.mjs'
import { WEB, webPath, isUnderWeb	} from './df-paths.mjs'
import { validateModel, parseCdeText, formatCdeDoc	} from './df-validate.mjs'

const
server = new McpServer( {
	name	: 'diagramforge'
,	version	: '1.0.0'
} )

const
textResult	= obj => ( {
	content	: [ { type: 'text', text: JSON.stringify( obj, null, '\t' ) } ]
} )

const
resolveCdePath	= rel => {
	const
	clean = rel.replace( /^\/+/, '' )
	,	abs = webPath( clean )
	if	( !isUnderWeb( abs ) ) throw new Error( `Path must be under Web/: ${ rel }` )
	if	( !clean.endsWith( '.cde' ) ) throw new Error( 'Path must end with .cde' )
	return	{ rel: clean, abs }
}

server.tool(
	'df_status'
,	'Check whether a browser editor is connected to df-server and which .cde file is watched.'
,	{}
,	async () => textResult( await dfStatus() )
)

server.tool(
	'df_get_model'
,	'Read the live diagram from the open browser ( nodes + links + canvas size ). Falls back to last cached snapshot.'
,	{}
,	async () => textResult( await dfGetModel() )
)

server.tool(
	'df_validate'
,	'Validate a DiagramForge model. Omit model to validate the live browser diagram.'
,	{
		model	: z.object( {
			nodes	: z.array( z.any() )
		,	links	: z.array( z.any() )
		} ).optional()
	}
,	async ( { model } ) => {
		if	( model ) return textResult( { ok: !validateModel( model ).length, issues: validateModel( model ) } )
		const	{ result } = await dfRpc( 'validate', {} )
		return	textResult( { ok: !result.length, issues: result } )
	}
)

server.tool(
	'df_apply'
,	`Apply one or more ops to the live diagram ( same ops as window.DF.apply ).
Ops: addNode, updateNode, removeNode, restack, addLink, updateLink, removeLink, autoLayout, setCanvas.
Example updateNode: { "op": "updateNode", "id": "VPN", "area": { "type": "rhombus", "cX": 960, "cY": 584, "rH": 512, "rV": 72, "html": "VPN" } }`
,	{
		ops	: z.array( z.record( z.any() ) )
	}
,	async ( { ops } ) => {
		const	{ result: issues } = await dfRpc( 'apply', { ops } )
		const	snap = await dfGetModel()
		return	textResult( { issues, ...snap } )
	}
)

server.tool(
	'df_auto_layout'
,	'Run a deterministic grid layout on the live diagram.'
,	{
		cols	: z.number().int().positive().optional()
	,	gap	: z.number().optional()
	,	startX	: z.number().optional()
	,	startY	: z.number().optional()
	}
,	async params => {
		await dfRpc( 'autoLayout', { algorithm: 'grid', ...params } )
		return	textResult( await dfGetModel() )
	}
)

server.tool(
	'df_load_file'
,	'Load a .cde file into the browser editor. Path is relative to Web/ ( e.g. Samples/JSONs.cde ).'
,	{
		path	: z.string()
	}
,	async ( { path: rel } ) => {
		resolveCdePath( rel )
		const	{ result } = await dfRpc( 'loadCde', { path: rel.replace( /^\/+/, '' ) } )
		return	textResult( result )
	}
)

server.tool(
	'df_save_file'
,	'Save the live diagram to a .cde file under Web/. Writes { model } only; canvas size is derived on load.'
,	{
		path	: z.string()
	}
,	async ( { path: rel } ) => {
		const	{ rel: clean, abs } = resolveCdePath( rel )
		,	snap = await dfGetModel()
		,	doc = { model: snap.model }
		,	issues = validateModel( doc.model )
		if	( issues.length ) return textResult( { saved: false, issues } )
		await writeFile( abs, formatCdeDoc( doc ) + '\n', 'utf8' )
		return	textResult( { saved: true, path: clean, nodeCount: doc.model.nodes.length, linkCount: doc.model.links.length } )
	}
)

server.tool(
	'df_read_file'
,	'Read a .cde file from disk ( no browser required ). Path relative to Web/.'
,	{
		path	: z.string()
	}
,	async ( { path: rel } ) => {
		const	{ rel: clean, abs } = resolveCdePath( rel )
		,	doc = parseCdeText( await readFile( abs, 'utf8' ) )
		return	textResult( { path: clean, ...doc, issues: validateModel( doc.model ) } )
	}
)

const
transport = new StdioServerTransport()
await server.connect( transport )

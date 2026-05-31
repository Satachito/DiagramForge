export	const
Report = alert

window.app		= {
	model	: {
		nodes	: []	//	[ ID, S, P ]	(S)hape		, (P)aint
	,	links	: []	//	[ [ F, { headF, headT, anchorF, anchorT }, T ], P ]
	}
,	reforms		: []	//	Equal to model.nodes
}

export	const
FindNode		= ID => app.model.nodes.find( _ => _[ 0 ] === ID )

export	const
FindReform		= ID => app.reforms.find( _ => _[ 0 ] === ID )

import Do from './Jobs.js'

const
DoTypical	= async ( label, redo ) => {
	const
	saved = structuredClone( app )
	await Do(	label
	,	async () => (
			await redo()
		,	MAIN_EDITOR.Draw()
		,	LINK_EDITOR.Sync()
		)
	,	async () => (
			app = saved
		,	MAIN_EDITOR.Draw()
		,	LINK_EDITOR.Sync()
		)
	)
}

export	const
Reform		= () => DoTypical(
	'Reform'
,	() => {
		const
		IDs = app.reforms.map( _ => _[ 0 ] )

		app.model.nodes = [
			...app.model.nodes.filter( _ => !IDs.includes( _[ 0 ] ) )
		,	...structuredClone( app.reforms )
		]
	}
)

const
GenerateID	= async $ => {
	if	( $ && !app.model.nodes.some( _ => _[ 0 ] === $ ) ) return $
	$ = String( ( new Date() ).getTime() - 176722560000 )	//	 Since 2026.01.01
	while	( app.model.nodes.some( _ => _[ 0 ] === $ ) ) {
		await new Promise( R => setTimeout( R, 1 ) )
		$ = String( ( new Date() ).getTime() - 176722560000 )	//	 Since 2026.01.01
	}
	return $
}

export	const
Node	= ( [ ID, S, P ] ) => DoTypical(
	'ApplyNode'
,	async () => {
		const
		node = FindNode( ID )
		if	( node ) {
			node[ 1 ] = S
			node[ 2 ] = P
			const
			reform = FindReform( ID )
			reform && (
				reform[ 1 ] = structuredClone( S )
			,	reform[ 2 ] = structuredClone( P )
			)
		} else {
			const
			$ = [ ID || await GenerateID(), S, P ]
			app.model.nodes.push( $ )
			app.reforms = [ structuredClone( $ ) ]
		}
	}
)

export	const
Link	= ( [ [ F, A, T ], P ] ) => DoTypical(
	'Link'
,	() => {
		const
		$ = app.model.links.filter( ( [ [ f, a, t ], p ] ) => f === F && t === T )
		$.length
		?	$.forEach(
				_ => (
					_[ 0 ][ 1 ] = A
				,	_[ 1 ] = P
				)
			)
		:	(	app.model.links.push( [ [ F, A, T ], P ] )
			,	app.reforms = [
					structuredClone( FindNode( F ) )
				,	structuredClone( FindNode( T ) )
				] 
			)
	}
)

export	const
RemoveLink	= ( F, T ) => DoTypical(
	'RemoveLink'
,	() => (
		app.model.links = app.model.links.filter(
			( [ [ f, a, t ], p ] ) => f !== F || t !== T
		)
	,	app.reforms = []
	)
)

export	const
Delete		= () => DoTypical(
	'Delete'
,	() => (
		app.model.nodes = app.model.nodes.filter(
			node => !FindReform( node[ 0 ] )
		)
	,	app.model.links = app.model.links.filter(
			( [ [ F, A, T ], P ] ) => !FindReform( F ) && !FindReform( T )
		)
	,	app.reforms = []
	)
)

export	const
Copy		= _ => _.setData(	//	ClipboardData
	'application/x-diagramforge-828-tokyo'
,	JSON.stringify( app.reforms.map( ( [ ID, S, P ] ) => [ S, P ] ) )
)

export	const
Paste		= async _ => {	//	ClipboardData

	const
	nodes = []

	{	const
		json = _.getData( 'application/x-diagramforge-828-tokyo' )
		if	( json ) try {
			nodes.push( ...JSON.parse( json ) )
		} catch ( er ) {
			console.error( er )
		}
	}

	{	_.items.filter( item => item.type === 'image/png' ).forEach(
			async item => {
				try {
					const blob = item.getAsFile()
					const bitmap = await createImageBitmap( blob )
					const W = bitmap.width
					const H = bitmap.height
					bitmap.close()

					nodes.push(
						[	{	type	: 'PNG'
							,	cX		: W / 2
							,	cY		: H / 2
							,	rH		: W / 2
							,	rV		: H / 2
							,	PNG		: btoa( String.fromCharCode( ...new Uint8Array( await blob.arrayBuffer() ) ) )
							}
						,	{}
						]
					)
				} catch ( er ) {
					console.error( er )
				}
			}
		)
	}

	{	const
		LoadImage = url => new Promise(
			( S, J ) => {
				const $ = new Image()
				$.onload = () => (
					S( $ )
				,	URL.revokeObjectURL( url )
				)
				$.onerror = () => (
					URL.revokeObjectURL( url )
				,	J( new Error( 'SVG load failed' ) ) 
				)
				$.src = url
			}
		)
		_.items.filter( item => item.type === 'image/svg+xml' ).forEach(
			async item => {
				try {
					const SVG = item.kind === 'string'
					?	await new Promise( S => item.getAsString( s => S( s ) ) )
					:	await item.getAsFile().text()
					const image = await LoadImage( URL.createObjectURL( new Blob( [ SVG ], { type: 'image/svg+xml;charset=utf-8' } ) ) )
					const [ W, H ] = [ image.naturalWidth, image.naturalHeight ]
					nodes.push(
						[	{	type	: 'SVG'
							,	cX		: W / 2
							,	cY		: H / 2
							,	rH		: W / 2
							,	rV		: H / 2
							,	SVG
							}
						,	{}
						]
					)
				} catch ( er ) {
					console.error( er )
				}
			}
		)
	}

	const $ = await Promise.all( nodes.map( async _ => [ await GenerateID(), ..._ ] ) )
	void DoTypical(
		'Paste'
	,	() => (
			app.model.nodes.push( ...$ )
		,	app.reforms = structuredClone( $ )
		)
	)
}

export	const
JSONString	= () => JSON.stringify( app.model, null, '\t' )

export	const		//	THROWS EXCEPTION
Load		= _ => DoTypical(
	'Load'
,	() => {
		app.model = JSON.parse( _ )
		app.reforms = []
	}
)


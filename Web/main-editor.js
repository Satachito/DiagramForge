import {
	AE
}	from './DomUtils.js'

import {
	Report
,	FindNode
,	FindReform
,	AvailableLinks
,	Reform
,	Node
,	EditNode
,	Restack
,	PreviewID
,	Link
,	EditLink
,	RemoveLink
,	Delete
,	Copy
,	Paste
,	STORAGE_KEY
,	JSONString
}	from './Application.js'

export	const
CANVAS_DEFAULT	= 4096


//	lazy ( a function, not a top-level const ): Application.js imports SetCanvasSize
//	from this module, so reading the Application export STORAGE_KEY at module-eval
//	time would hit a temporal-dead-zone error in that import cycle. Computing it on
//	demand keeps this module free of any top-level dependency on Application.js.
const
canvasStorageKey	= () => `${ STORAGE_KEY }.canvas`

export	const
loadStoredCanvasSize	= () => {
	try {
		const
		[ w, h ] = JSON.parse( localStorage.getItem( canvasStorageKey() ) )
		if	( w > 0 && h > 0 )	return [ w, h ]
	} catch {}
	return [ CANVAS_DEFAULT, CANVAS_DEFAULT ]
}

export	const
CanvasSize		= () => MAIN_EDITOR.canvasSize()

export	const
SetCanvasSize	= ( width, height ) => {
	if	( !( width > 0 && height > 0 ) )	throw new Error( `Invalid canvas size: ${ width }×${ height }` )
	MAIN_EDITOR.setCanvasSize( width, height )
	localStorage.setItem( canvasStorageKey(), JSON.stringify( [ width, height ] ) )
}


import {
	Redo
,	Undo
}	from './Jobs.js'

import {
	XYWH_TLBR
,	TLBR_XYXY
,	EdgeDist
,	ContainsXY
,	ContainsTLBR
,	AreaTLBR
,	XYWH_XYXY
,	XY_EV
,	AddXY
,	DivXY
,	EqualXY
,	DeltaXY
,	Outset
}	from './Geo2D.js'

import {
	XYWH
,	TLBR
,	BBox
,	RectPath2D
,	EllipsePath2D
,	RhombusPath2D
,	GRAB
,	C2D
,	LinkMetrics
,	shaftSpec
,	shaftToPath
}	from './GeoDF.js'

const
strokeHeadPath	= ( c2D, pts, close ) => {
	c2D.beginPath()
	c2D.moveTo( ...pts[ 0 ] )
	for	( let i = 1; i < pts.length; i++ )	c2D.lineTo( ...pts[ i ] )
	close && c2D.closePath()
}

const
DrawHeadCanvas	= ( c2D, h, headFill, stroke ) => {
	if	( h.kind === 'circle' ) {
		c2D.beginPath()
		c2D.arc( h.center[ 0 ], h.center[ 1 ], h.r, 0, 2 * Math.PI )
		h.fill
		?	( c2D.fillStyle = headFill, c2D.fill() )
		:	( c2D.strokeStyle = stroke, c2D.stroke() )
		return
	}
	if	( h.kind === 'line' ) {
		strokeHeadPath( c2D, h.pts, false )
		c2D.strokeStyle = stroke
		c2D.stroke()
		return
	}
	strokeHeadPath( c2D, h.pts, true )
	h.fill
	?	( c2D.fillStyle = headFill, c2D.fill() )
	:	( c2D.strokeStyle = stroke, c2D.stroke() )
}

const
DrawLinkCanvas	= ( c2D, _ ) => {

	const
	$ = LinkMetrics( _ )
	if	( !$ ) return

	const
	P = _[ 2 ]

	c2D.save()

	P.stroke			&& ( c2D.strokeStyle	= P.stroke			)
	P.lineWidth			&& ( c2D.lineWidth		= P.lineWidth		)
	P.lineCap			&& ( c2D.lineCap		= P.lineCap			)
	P.lineJoin			&& ( c2D.lineJoin		= P.lineJoin		)
	P.lineDashOffset	&& ( c2D.lineDashOffset = P.lineDashOffset	)
	P.lineDash			&& c2D.setLineDash( P.lineDash )

	c2D.beginPath()
	shaftToPath( c2D, shaftSpec( $.shaft, _[ 1 ].corner ) )
	c2D.stroke()

	//	heads are always solid and rounded, regardless of the shaft's dash / caps
	c2D.setLineDash( [] )
	c2D.lineJoin	= 'round'
	c2D.lineCap		= 'round'
	const
	headFill = P.fill ?? P.stroke
	for ( const h of $.heads )	DrawHeadCanvas( c2D, h, headFill, P.stroke )

	c2D.restore()
}

const
HitLink			= ( _, xy ) => {

	const
	$ = LinkMetrics( _ )
	if	( !$ ) return

	const
	P = _[ 2 ]

	C2D.save()
	try {
		C2D.lineWidth = Math.max( P.lineWidth ?? GRAB, GRAB )

		C2D.beginPath()
		shaftToPath( C2D, shaftSpec( $.shaft, _[ 1 ].corner ) )
		if	( C2D.isPointInStroke( ...xy ) ) return true

		for ( const h of $.heads ) {
			if	( h.kind === 'circle' ) {
				C2D.beginPath()
				C2D.arc( h.center[ 0 ], h.center[ 1 ], h.r, 0, 2 * Math.PI )
				if	( C2D.isPointInPath( ...xy ) ) return true
				continue
			}
			C2D.beginPath()
			C2D.moveTo( ...h.pts[ 0 ] )
			for	( let i = 1; i < h.pts.length; i++ )	C2D.lineTo( ...h.pts[ i ] )
			if	( h.kind === 'line' ) {
				if	( C2D.isPointInStroke( ...xy ) ) return true
			} else {
				C2D.closePath()
				if	( C2D.isPointInPath( ...xy ) ) return true
			}
		}
		return false
	} finally {
		C2D.restore()
	}
}

import { DrawForeignLabel	} from './ForeignLabel.js'

const
NodeMode = ev => CREATE_NODE.checked || !!ev?.metaKey
const
LinkMode = ev => CREATE_LINK.checked || !!ev?.altKey

const
Node_XY		= xy => {
	let	$ = null
	app.model.nodes.forEach(
		_ => {
			const _tlbr = TLBR( _[ 1 ] )
			if	( ContainsXY( Outset( _tlbr, GRAB ), xy ) ) {
				if	( $ ) {
					const _minEdgeDist	= Math.min( ...EdgeDist( _tlbr, xy ) )
					const tlbr			= TLBR( $[ 1 ] )
					const minEdgeDist	= Math.min( ...EdgeDist( tlbr, xy ) )
					_minEdgeDist < minEdgeDist
					?	$ = _
					:	_minEdgeDist === minEdgeDist && ( AreaTLBR( _tlbr ) < AreaTLBR( tlbr ) ) && ( $ = _ )
				} else {
					$ = _
				}
			}
		}
	)
	return	$
}
const
Node_EV		= ev => Node_XY( XY_EV( ev ) )

const
Links_XY	= xy => AvailableLinks().reduce(
	( $, _ ) => {
		HitLink( _, xy ) && $.push( _ )
		return $
	}
,	[]
)

//	which end zone ( if any ) of a single link the point lands on → 'F' | 'T'.
//	fixed GRAB-radius circles at each end ( see LinkMetrics.ends ), on the shaft
//	side of the boundary tip — so the head menu is reachable even when that end
//	currently has no arrowhead, and clicks never fall onto the node.
const
HeadEnd_XY	= ( _, xy ) => {

	const
	$ = LinkMetrics( _ )
	if	( !$ ) return null

	for ( const z of $.ends ) {
		const
		dx = xy[ 0 ] - z.c[ 0 ]
	,	dy = xy[ 1 ] - z.c[ 1 ]
		if	( dx * dx + dy * dy <= GRAB * GRAB )	return z.end
	}
	return null
}

//	first link whose arrowhead is under the point → { link, end } | null
const
Head_XY		= xy => {
	for ( const _ of AvailableLinks() ) {
		const
		end = HeadEnd_XY( _, xy )
		if	( end ) return { link: _, end }
	}
	return null
}

const
BBoxGrabCursor	= ( bbox, xy ) => {
	const
	[ T, L, B, R ] = EdgeDist( bbox, xy ).map( _ => _ <= 0 )

	if	( ( T && L ) || ( B && R ) ) return 'nwse-resize'
	if	( ( T && R ) || ( B && L ) ) return 'nesw-resize'

	if	( T || B ) return 'ns-resize'
	if	( L || R ) return 'ew-resize'

	return 'move'
}
const
Cursor_EV	= ev => {
	
	const
	xy = XY_EV( ev )

	if	( app.reforms.length ) {
		const
		bbox = BBox( app.reforms )
		if	( ContainsXY( bbox, xy ) )					return 'move'
		if	( ContainsXY( Outset( bbox, GRAB ), xy ) )	return BBoxGrabCursor( bbox, xy )
	}

	if	( NodeMode( ev ) || LinkMode( ev ) )			return 'crosshair'

	if	( Links_XY( xy ).length )						return 'pointer'

	const	node = Node_XY( xy )
	if	( node ) return BBoxGrabCursor( TLBR( node[ 1 ] ), xy )

	return	'default'
}


const
copyText		= text => navigator.clipboard.writeText( text ).catch( Report )

const
mouse			= [ null, null ]

const
DrawPath		= ( c2D, path, P ) => {
	c2D.save()
	const	fill	= P[ 'fill'	]
	if	( fill ) {
		c2D.fillStyle = fill
		c2D.fill( path )
	}
	const	stroke	= P[ 'stroke' ]
	if	( stroke ) {
		P.lineWidth			&& ( c2D.lineWidth		= P.lineWidth		)
		P.lineCap			&& ( c2D.lineCap		= P.lineCap			)
		P.lineJoin			&& ( c2D.lineJoin		= P.lineJoin		)
		P.miterLimit		&& ( c2D.miterLimit		= P.miterLimit		)
		P.lineDash			&& ( c2D.setLineDash	( P.lineDash )		)
		P.lineDashOffset	&& ( c2D.lineDashOffset	= P.lineDashOffset	)
		c2D.strokeStyle = stroke
		c2D.stroke( path )
	}
	c2D.restore()
}

const
ShowHoverLabel = ( ev, text ) => {
	UNDER_HOVER.textContent		= text
	UNDER_HOVER.style.display	= 'block'
	UNDER_HOVER.style.left		= `${ ev.clientX + 12 }px`
	UNDER_HOVER.style.top		= `${ Math.max( 8, ev.clientY - 28 ) }px`
}
const
UpdateHoverLabel = ev => {
	const
	xy = XY_EV( ev )
	//	links take priority over nodes ( same as the pointer cursor ), so a link
	//	running under a node still reports its endpoints rather than the node id
	const
	links = Links_XY( xy )
	if	( links.length ) {
		const	[ [ nF, nT ] ] = links[ 0 ]
		return ShowHoverLabel( ev, `${ nF[ 0 ] } - ${ nT[ 0 ] }` )
	}
	const
	node = Node_XY( xy )
	if	( !node ) {
		UNDER_HOVER.style.display = 'none'
		return
	}
	ShowHoverLabel( ev, node[ 0 ] )
}


export default class
MainEditor extends HTMLElement {

	Draw() {
		window.EMPTY_HINT && ( window.EMPTY_HINT.style.display = app.model.nodes.length ? 'none' : '' )
		return Promise.all( [ this.DrawModel(), this.DrawReforms() ] ).catch( Report )
	}

	canvasSize() {
		return	[ this.drawer.width, this.drawer.height ]
	}

	setCanvasSize( w, h ) {
		if	( !( w > 0 && h > 0 ) )	throw new Error( `Invalid canvas size: ${ w }×${ h }` )
		this.drawer.width		= this.reformer.width		= w
		this.drawer.height		= this.reformer.height		= h
	}

	clearInteraction() {
		mouse[ 0 ] = mouse[ 1 ] = null
		this.drag = null
	}

	async DrawModel() {

		const	c2D = this.drawer.getContext( '2d' )

		const
		drawSVG		= async ( svg, S ) => {
			//	SVG must go through <img>: createImageBitmap() rejects SVG blobs
			//	in Chrome ("The source image could not be decoded").
			const
			url = URL.createObjectURL( new Blob( svg, { type: 'image/svg+xml;charset=utf-8' } ) )
			try {
				const
				image = new Image()
				image.src = url
				image.decode ? await image.decode() : await new Promise(
					( Res, Rej ) => (
						image.onload	= () => Res()
					,	image.onerror	= () => Rej( new Error( 'SVG: loading failed' ) )
					)
				)
				c2D.drawImage( image, ...XYWH( S ) )
			} finally {
				URL.revokeObjectURL( url )
			}
		}

		c2D.clearRect( 0, 0, this.drawer.width, this.drawer.height )

		for ( const [ ID, S, P ] of app.model.nodes ) {
			try {
				switch ( S.type ) {
				case 'rect':
					DrawPath( c2D, RectPath2D( S ), P )
					break
				case 'ellipse':
					DrawPath( c2D, EllipsePath2D( S ), P )
					break
				case 'rhombus':
					DrawPath( c2D, RhombusPath2D( S ), P )
					break
				case 'SVG':
					await drawSVG(
						[ Uint8Array.from( atob( S.SVG ), ch => ch.charCodeAt( 0 ) ) ]
					,	S
					)
					break
				case 'PNG':
					c2D.drawImage(
						await createImageBitmap(
							new Blob(
								[ Uint8Array.from( atob( S.PNG ), _ => _.charCodeAt( 0 ) ) ]
							,	{ type: 'image/png' }
							)
						)
					,	...XYWH( S )
					)
					break
				default:
					console.error( 'Unknown:', S.type )
					break
				}
				if	( S.html )	await DrawForeignLabel( drawSVG, S )
			} catch ( er ) {
				console.error( 'DrawModel failed:', ID, er )
			}
		}

		AvailableLinks().forEach( _ => DrawLinkCanvas( c2D, _ ) )
	}

	async DrawReforms() {
		const	c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

//	TODO: REFACTOR
		//	redraw every link touching the selection: a moving end follows its
		//	reform clone, a fixed end stays on its model node ( so half-selected
		//	links track the drag instead of being left behind )
		for ( const [ [ F, T ], A, P ] of app.model.links ) {
			const	rF = FindReform( F )
			const	rT = FindReform( T )
			if	( !rF && !rT ) continue
			const	nF = rF || FindNode( F )
			const	nT = rT || FindNode( T )
			nF && nT && DrawLinkCanvas( c2D, [ [ nF, nT ], A, P ] )
//			c2D, nF[ 1 ], A, nT[ 1 ], S, { paintF: nF[ 2 ], paintT: nT[ 2 ] }
		}

		if	( app.reforms.length ) {
			c2D.save()
			c2D.strokeStyle = '#00ffff'
			c2D.lineWidth = 4
			for ( const [ , S ] of app.reforms ) c2D.strokeRect( ...XYWH( S ) )
			c2D.strokeStyle = '#ff0000'
			c2D.lineWidth = 2
			const	[ hT, hL, hB, hR ] = BBox( app.reforms )
			c2D.strokeRect( ...XYWH_TLBR( [ hT, hL, hB, hR ] ) )
			//	resize handles: 4 corners fully outside the selection box
			const	HS = 8, gap = 1
			c2D.fillStyle = '#ffffff'
			c2D.lineWidth = 1.5
			for ( const [ x, y ] of [
				[ hL - HS, hT - HS ]
			,	[ hR + gap, hT - HS ]
			,	[ hL - HS, hB + gap ]
			,	[ hR + gap, hB + gap ]
			] ) {
				c2D.fillRect( x, y, HS, HS )
				c2D.strokeRect( x, y, HS, HS )
			}
			c2D.restore()
		} else {
			mouse[ 0 ] && mouse[ 1 ] && (
				c2D.save()
			,	c2D.strokeStyle = '#888888'
			,	c2D.lineWidth = 2
			,	c2D.strokeRect( ...XYWH_XYXY( mouse ) )
			,	c2D.restore()
			)
		}
	}

	constructor() {
		super()

		this.style.position			= 'relative'

		this.drawer					= AE( this, 'canvas' )
		this.reformer				= AE( this, 'canvas' )
		this.drawer.style.position	= this.reformer.style.position	= 'absolute'
		//	stop the browser from claiming the drag as a scroll / gesture ( which
		//	would fire pointercancel and abort the move before pointerup commits )
		this.reformer.style.touchAction	= 'none'
		this.setCanvasSize( ...loadStoredCanvasSize() )
		this.linkMenuKey			= null
		this.headMenuTarget			= null
		this.nodeMenuTarget			= null
		this.panning				= null	//	{ x, y } client coords while hand-tool panning
		this.spaceDown				= false	//	space held → hand tool armed
		this.hoverXY				= null	//	last hover position, for refreshModeCursor

		LINK_MENU_EDIT.onclick	= async ev => {
			ev.stopPropagation()
			const
			key = this.linkMenuKey
			this.hideContextMenus()
			key && await this.editLink( key )
		}

		LINK_MENU_REMOVE.onclick	= ev => (
			ev.stopPropagation()
		,	this.linkMenuKey && RemoveLink( [ this.linkMenuKey[ 0 ], this.linkMenuKey[ 1 ] ] )
		,	this.hideContextMenus()
		,	this.reformer.focus()
		)

		for ( const b of HEAD_MENU.querySelectorAll( 'button.head-opt' ) ) {
			b.onclick = ev => (
				ev.stopPropagation()
			,	this.setLinkHead( b.dataset.head || '' )
			,	this.hideContextMenus()
			,	this.reformer.focus()
			)
		}

		NODE_MENU_EDIT.onclick	= async ev => {
			ev.stopPropagation()
			const
			target = this.nodeMenuTarget
			this.hideContextMenus()
			target && await this.editNode( target )
		}

		NODE_MENU_FRONT.onclick	= async ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && await Restack( this.nodeMenuTarget[ 0 ], true )
		,	this.hideContextMenus()
		,	this.reformer.focus()
		)

		NODE_MENU_BACK.onclick	= async ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && await Restack( this.nodeMenuTarget[ 0 ], false )
		,	this.hideContextMenus()
		,	this.reformer.focus()
		)

		NODE_MENU_DELETE.onclick	= async ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && await Delete()
		,	this.hideContextMenus()
		,	this.reformer.focus()
		)

		NODE_MENU_COPY_ID.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 0 ] )
		,	this.hideContextMenus()
		)

		NODE_MENU_COPY_HTML.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 1 ].html ?? '' )
		,	this.hideContextMenus()
		)

		NODE_MENU_COPY_STYLE.onclick	= ev => (
			ev.stopPropagation()
		,	this.nodeMenuTarget && copyText( this.nodeMenuTarget[ 1 ].style ?? '' )
		,	this.hideContextMenus()
		)

		//	window-level: catches clicks outside main-editor too
		//	capture(true): runs before stopPropagation() in menu onclick handlers
		addEventListener( 'pointerdown', ev => {
			if	( LINK_MENU.style.display === 'none' && HEAD_MENU.style.display === 'none' && NODE_MENU.style.display === 'none' ) return
			if	( LINK_MENU.contains( ev.target ) || HEAD_MENU.contains( ev.target ) || NODE_MENU.contains( ev.target ) ) return
			this.hideContextMenus()
		}, true )

		this.reformer.oncontextmenu	= ev => this.onContextMenu( ev )
		this.reformer.oncopy		= ev => ( ev.preventDefault(), Copy( ev.clipboardData ) )
		this.reformer.oncut			= ev => ( this.reformer.oncopy( ev ), Delete() )
		this.reformer.onpaste		= ev => ( ev.preventDefault(), Paste( ev.clipboardData ) )

		//	window-level so shortcuts work without the canvas being focused
		addEventListener( 'keydown', ev => this.onKeyDown( ev ) )
		//	⌘/⌥ momentarily act as Create-node / Create-link; refresh cursor on release
		addEventListener( 'keyup', ev => (
			ev.key === ' ' && ( this.spaceDown = false )
		,	this.refreshModeCursor( ev )
		) )
		//	entering create-node mode: clear NODE_ID so the placeholder ( the next
		//	auto-id ) shows and a previously selected node's id can't pollute the new node
		CREATE_NODE.onchange = () => (
			CREATE_NODE.checked && ( NODE_ID.value = '', NODE_ID.placeholder = PreviewID() )
		,	this.refreshModeCursor()
		)
		CREATE_LINK.onchange = () => this.refreshModeCursor()

		//	keep the auto-id placeholder current whenever the empty field is focused
		NODE_ID.addEventListener( 'focus', () => NODE_ID.value || ( NODE_ID.placeholder = PreviewID() ) )

		//	show a live auto-id placeholder from the start
		NODE_ID.placeholder = PreviewID()

		//	Pointer Capture: once a drag starts we capture the pointer so move/up
		//	are delivered to the canvas even when the cursor leaves it — the release
		//	(commit) is never lost over a panel or off-window.
		this.reformer.onpointerleave	= () => ( UNDER_HOVER.style.display = 'none' )
		//	suppress middle-click autoscroll so middle-drag can pan instead
		this.reformer.addEventListener( 'mousedown', ev => ev.button === 1 && ev.preventDefault() )
		this.reformer.onpointerdown		= ev => this.onMouseDown( ev )
		this.reformer.onpointermove		= ev => this.onMouseMove( ev )
		this.reformer.onpointerup		= ev => this.onMouseUp( ev )
		//	if the browser cancels the pointer mid-drag, commit what we have rather
		//	than silently dropping it ( onMouseUp no-ops when nothing was dragged )
		this.reformer.onpointercancel	= ev => this.onMouseUp( ev )

		matchMedia( '(prefers-color-scheme: dark)' ).addEventListener(
			'change'
		,	() => this.Draw()
		)
	}

	setLinkHead( style ) {
		if	( !this.headMenuTarget ) return
		const
		{ F, T, end } = this.headMenuTarget
		,	link = app.model.links.find( ( [ [ f, t ] ] ) => f === F && t === T )
		if	( !link ) return
		const
		A = structuredClone( link[ 1 ] ?? {} )
		,	key = end === 'F' ? 'headF' : 'headT'
		style ? ( A[ key ] = style ) : ( delete A[ key ] )
		Link( [ [ F, T ], A, link[ 2 ] ] )
	}

	hideContextMenus() {
		LINK_MENU.style.display	= 'none'
		HEAD_MENU.style.display	= 'none'
		NODE_MENU.style.display	= 'none'
		this.linkMenuKey		= null
		this.headMenuTarget		= null
		this.nodeMenuTarget		= null
	}

	positionContextMenu( menu, ev ) {
		const	pad	= 8
		const	w	= menu.offsetWidth	|| 120
		const	h	= menu.offsetHeight	|| 40
		menu.style.left	= `${ Math.max( pad, Math.min( ev.clientX, innerWidth - w - pad ) ) }px`
		menu.style.top	= `${ Math.max( pad, Math.min( ev.clientY, innerHeight - h - pad ) ) }px`
	}

	//	idle / hover cursor. Recompute from the last hover position so that pressing
	//	a key that doesn't change the mode ( e.g. Shift while resizing an edge ) keeps
	//	the resize / move / pointer affordance instead of snapping back to 'default'.
	refreshModeCursor( ev ) {
		if	( mouse[ 0 ] !== null )	return	//	mid-drag: keep the drag cursor
		if	( this.spaceDown ) {
			this.reformer.style.cursor = 'grab'
			return
		}
		this.reformer.style.cursor = this.hoverXY
		?	Cursor_EV( { offsetX: this.hoverXY[ 0 ], offsetY: this.hoverXY[ 1 ], metaKey: ev?.metaKey, altKey: ev?.altKey } )
		:	( ( NodeMode( ev ) || LinkMode( ev ) ) ? 'crosshair' : 'default' )
	}

	//	modal prompt for a new node's id. Resolves '' ( auto-assign ), the typed id,
	//	or null when cancelled. Rejects a typed id that already exists ( keeps open ).
	promptNodeId() {
		return	new Promise( resolve => {
			const
			finish = val => {
				NODE_ID_DIALOG_FORM.onsubmit	= null
				NODE_ID_DIALOG_CANCEL.onclick	= null
				NODE_ID_DIALOG.oncancel			= null
				NODE_ID_DIALOG.open && NODE_ID_DIALOG.close()
				this.reformer.focus()
				resolve( val )
			}
			NODE_ID_DIALOG_INPUT.value			= ''
			NODE_ID_DIALOG_INPUT.placeholder	= PreviewID()
			NODE_ID_DIALOG_ERR.textContent		= ''
			NODE_ID_DIALOG_FORM.onsubmit	= ev => {
				ev.preventDefault()
				const
				v = NODE_ID_DIALOG_INPUT.value.trim()
				if	( v && FindNode( v ) ) {
					NODE_ID_DIALOG_ERR.textContent = `ID "${ v }" already exists`
					return
				}
				finish( v )
			}
			NODE_ID_DIALOG_CANCEL.onclick	= () => finish( null )
			NODE_ID_DIALOG.oncancel			= ev => ( ev.preventDefault(), finish( null ) )
			NODE_ID_DIALOG.showModal()
			NODE_ID_DIALOG_INPUT.focus()
		} )
	}

	async editLink( [ F, T ] ) {
		const
		link = app.model.links.find( ( [ [ f, t ] ] ) => f === F && t === T )
		if	( !link ) return
		LINK_EDITOR.$	= [ [ F, T ], link[ 1 ] ?? {}, link[ 2 ] ?? {} ]
		//	borrow the aside link-editor into the modal, then return it on close
		LINK_EDITOR_SLOT.appendChild( LINK_EDITOR )
		let	$
		try {
			$ = await this.promptLinkEndpoints( F, T )
		} finally {
			LINK_EDITOR_HOME.appendChild( LINK_EDITOR )
		}
		if	( !$ ) return
		await EditLink( [ F, T ], $ )
		this.reformer.focus()
	}

	//	modal hosting the full link-editor. Resolves the edited [ [ F, T ], A, P ]
	//	or null when cancelled. Rejects a self-link or a duplicate of another link.
	promptLinkEndpoints( F, T ) {
		return	new Promise( resolve => {
			LINK_EDGE_DIALOG_ERR.textContent	= ''

			const
			finish = val => {
				LINK_EDGE_DIALOG_FORM.onsubmit	= null
				LINK_EDGE_DIALOG_CANCEL.onclick	= null
				LINK_EDGE_DIALOG.oncancel		= null
				LINK_EDGE_DIALOG.open && LINK_EDGE_DIALOG.close()
				this.reformer.focus()
				resolve( val )
			}
			LINK_EDGE_DIALOG_FORM.onsubmit	= ev => {
				ev.preventDefault()
				const
				$ = LINK_EDITOR.$			//	[ [ nF, nT ], A, P ]
				,	[ [ nF, nT ] ] = $
				if	( nF === nT ) {
					LINK_EDGE_DIALOG_ERR.textContent = 'from and to are the same'
					return
				}
				if	(
					( nF !== F || nT !== T )
				&&	app.model.links.some( ( [ [ f, t ] ] ) => f === nF && t === nT )
				) {
					LINK_EDGE_DIALOG_ERR.textContent = `link ${ nF } → ${ nT } already exists`
					return
				}
				finish( $ )
			}
			LINK_EDGE_DIALOG_CANCEL.onclick	= () => finish( null )
			LINK_EDGE_DIALOG.oncancel		= ev => ( ev.preventDefault(), finish( null ) )
			LINK_EDGE_DIALOG.showModal()
		} )
	}

	async editNode( node ) {
		NODE_ID.value	= node[ 0 ]
		NODE_EDITOR.$	= [ node[ 1 ], node[ 2 ] ]
		//	borrow the aside node-editor ( + id row ) into the modal, return on close
		NODE_EDITOR_SLOT.append( NODE_ID_ROW, NODE_EDITOR )
		let	$
		try {
			$ = await this.promptNode( node[ 0 ] )
		} finally {
			NODE_EDITOR_HOME.append( NODE_ID_ROW, NODE_EDITOR )
		}
		if	( !$ ) return
		await EditNode( node[ 0 ], $ )
		this.reformer.focus()
	}

	//	modal hosting the full node-editor. Resolves the edited [ ID, S, P ] or
	//	null when cancelled. Rejects an empty id or one taken by another node.
	promptNode( oldID ) {
		return	new Promise( resolve => {
			NODE_EDIT_DIALOG_ERR.textContent	= ''

			const
			finish = val => {
				NODE_EDIT_DIALOG_FORM.onsubmit	= null
				NODE_EDIT_DIALOG_CANCEL.onclick	= null
				NODE_EDIT_DIALOG.oncancel		= null
				NODE_EDIT_DIALOG.open && NODE_EDIT_DIALOG.close()
				this.reformer.focus()
				resolve( val )
			}
			NODE_EDIT_DIALOG_FORM.onsubmit	= ev => {
				ev.preventDefault()
				const
				id = NODE_ID.value.trim()
				,	[ S, P ] = NODE_EDITOR.$
				if	( !id ) {
					NODE_EDIT_DIALOG_ERR.textContent = 'ID is required'
					return
				}
				if	( id !== oldID && FindNode( id ) ) {
					NODE_EDIT_DIALOG_ERR.textContent = `ID "${ id }" already exists`
					return
				}
				finish( [ id, S, P ] )
			}
			NODE_EDIT_DIALOG_CANCEL.onclick	= () => finish( null )
			NODE_EDIT_DIALOG.oncancel		= ev => ( ev.preventDefault(), finish( null ) )
			NODE_EDIT_DIALOG.showModal()
		} )
	}

	async onKeyDown( ev ) {
		this.refreshModeCursor( ev )
		const	t = ev.target
		if	( t && ( /^(INPUT|TEXTAREA|SELECT)$/.test( t.tagName ) || t.isContentEditable ) ) return
		switch ( ev.key ) {
		case 'z':	case 'Z':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await ( ev.shiftKey ? Redo() : Undo() ) }
			break
		case 'y':	case 'Y':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await Redo() }
			break
		case 'a':	case 'A':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await this.selectAll() }
			break
		case 'e':	case 'E':
			if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await this.expand() }
			break
		case ' ':
			//	space arms the hand tool ( space + left-drag pans )
			ev.preventDefault()
			this.spaceDown = true
			this.panning || ( this.reformer.style.cursor = 'grab' )
			break
		case 'Escape':
			mouse[ 0 ] = mouse[ 1 ] = null
			this.drag = null
			this.hideContextMenus()
			await this.DrawReforms()
			break
		case 'Delete':
		case 'Backspace':
			ev.preventDefault()
			await Delete()
			break
		default:
			break
		}
	}

	//	add a node (clone) to the selection if not already present
	registReform( _ ) {
		return FindReform( _[ 0 ] ) || app.reforms.push( structuredClone( _ ) )
	}

	async selectAll() {
		app.reforms = app.model.nodes.map( _ => structuredClone( _ ) )
		await this.DrawReforms()
	}

	setEditor( node ) {
		NODE_ID.value		= node[ 0 ]
		NODE_EDITOR.$		= [ node[ 1 ], node[ 2 ] ]
	}

	//	the reform with the largest area ( rH * rV ); used to decide which node a
	//	multi-select move / resize should leave in the node editor
	largestReform() {
		return	app.reforms.reduce(
			( best, _ ) =>
				!best || _[ 1 ].rH * _[ 1 ].rV > best[ 1 ].rH * best[ 1 ].rV ? _ : best
		,	null
		)
	}

	setEditorToLargestReform() {
		const
		_ = this.largestReform()
		_ && this.setEditor( _ )
	}

	//	shift+click: extend the selection with the node and everything it contains
	async addWithContained( node ) {
		NODE_ID.value		= node[ 0 ]
		NODE_EDITOR.$		= [ node[ 1 ], node[ 2 ] ]
		const
		tlbr = TLBR( node[ 1 ] )
		this.registReform( node )
		app.model.nodes.forEach(
			_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
		)
		await this.DrawReforms()
	}

	//	⌘E: expand the current selection to include everything it contains
	//	(a node with nothing inside it simply stays as-is). Selection only,
	//	so it is not part of the undo history.
	async expand() {
		if	( !app.reforms.length ) return
		app.reforms.slice().forEach(
			reform => {
				const
				node = FindNode( reform[ 0 ] )
				if	( !node ) return
				const
				tlbr = TLBR( node[ 1 ] )
				app.model.nodes.forEach(
					_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
				)
			}
		)
		await this.DrawReforms()
	}

	async onContextMenu( ev ) {
		const
		xy = XY_EV( ev )
		//	an arrowhead is the most specific target → its own style menu
		const
		head = Head_XY( xy )
		if	( head ) {
			ev.preventDefault()
			this.hideContextMenus()
			const
			[ [ nF, nT ], A ] = head.link
			this.headMenuTarget	= { F: nF[ 0 ], T: nT[ 0 ], end: head.end }
			const
			cur = ( head.end === 'F' ? A.headF : A.headT ) || ''
			for ( const b of HEAD_MENU.querySelectorAll( 'button.head-opt' ) )
				b.classList.toggle( 'active', ( b.dataset.head || '' ) === cur )
			HEAD_MENU.style.display	= 'block'
			this.positionContextMenu( HEAD_MENU, ev )
			return
		}
		const
		links = Links_XY( xy )
		if	( links.length ) {
			ev.preventDefault()
			this.hideContextMenus()
			this.linkMenuKey	= links[ 0 ][ 0 ].map( _ => _[ 0 ] )	//	[ nodeF, nodeT ] → [ idF, idT ]
			LINK_MENU.style.display	= 'block'
			this.positionContextMenu( LINK_MENU, ev )
			return
		}
		const
		node = Node_EV( ev )
		if	( ! node ) return
		ev.preventDefault()
		this.hideContextMenus()

		app.reforms			= []
		this.registReform( node )
		await this.DrawReforms()

		this.setEditor( node )

		this.nodeMenuTarget		= node
		NODE_MENU.style.display	= 'block'
		this.positionContextMenu( NODE_MENU, ev )
	}

	async onMouseDown( ev ) {
		this.reformer.tabIndex = 0

		//	PAN ( hand tool ): middle-drag, or space + left-drag. Moves by raw client
		//	delta — not canvas coords, which would jump as content scrolls under the cursor.
		if	( ev.button === 1 || ( ev.button === 0 && this.spaceDown ) ) {
			ev.preventDefault()
			this.panning = { x: ev.clientX, y: ev.clientY }
			ev.pointerId != null && this.reformer.setPointerCapture( ev.pointerId )
			this.reformer.style.cursor = 'grabbing'
			return
		}

		if	( ev.button ) return

		//	capture the pointer for the whole gesture so pointerup always lands here
		ev.pointerId != null && this.reformer.setPointerCapture( ev.pointerId )

		const
		xy	= mouse[ 0 ] = XY_EV( ev )

		let
		needsRedraw	= false

		try {
//	SELECTION
			if	( app.reforms.length ) {
				const
				bbox = BBox( app.reforms )
//	SELECTION GRAB
				if	( ContainsXY( bbox, xy ) ) {
					this.drag = this.beginMove()
					return
				}
//	SELECTION INSIDE
				if	( ContainsXY( Outset( bbox, GRAB ), xy ) ) {
					this.drag = this.beginResize()
					return
				}
//	SELECTION OUTSIDE
				app.reforms.length = 0
				needsRedraw = true
			}

//	LINK
			for	( const link of AvailableLinks() ) {
				const
				[ [ nF, nT ], A, P ] = link
				HitLink( link, xy ) && (
					this.registReform( nF )
				,	this.registReform( nT )
				,	LINK_EDITOR.$ = [ [ nF[ 0 ], nT[ 0 ] ], A, P ]
				)
			}
			if	( app.reforms.length ) {
				needsRedraw = true
				this.drag = this.beginMove()
				return
			}

//	NODE — create / link modes take precedence over hitting existing nodes
			if	( NodeMode( ev ) ) {
				this.drag = this.beginCreate()
				return
			}

			const
			$ = Node_EV( ev )
			if	( LinkMode( ev ) ) {
				this.drag = $ ? this.beginLink() : this.beginArea()
				return
			}

			void (
				$
				?	(	this.drag = ContainsXY( TLBR( $[ 1 ] ), xy ) ? this.beginMove() : this.beginResize()
					,	ev.shiftKey
						?	(	this.setEditor( $ )
							,	this.registReform( $ )
							)
						:	this.addWithContained( $ )
					)
				:	this.drag = this.beginArea()
			)
		} finally {
			needsRedraw && await this.DrawReforms()
		}
	}

	//	each gesture is a { draw, commit } handler decided at mousedown:
	//	draw renders the in-progress drag, commit applies it on mouseup
	beginMove() {
		return	{
			draw	: ( c2D, d, u ) => {
				const	[ dX, dY ] = DeltaXY( d, u )
				app.reforms.forEach(
					( [ ID, S ] ) => {
						const	s = FindNode( ID )[ 1 ]
						S.cX = s.cX + dX
						S.cY = s.cY + dY
					}
				)
				return	this.DrawReforms()
			}
		,	commit	: async () => {
				await Reform()
				this.setEditorToLargestReform()
			}
		}
	}

	beginResize() {
		return	{
			draw	: ( c2D, d, u ) => {
				let		edgeMode = false
				const	tlbr = BBox( app.reforms.map( _ => FindNode( _[ 0 ] ) ) )
				const	edgeDist = EdgeDist( tlbr, d )
				const	[ t, l, b, r ] = tlbr
				const	T = edgeDist[ 0 ] <= GRAB ? ( edgeMode = true, u[ 1 ] ) : t
				const	L = edgeDist[ 1 ] <= GRAB ? ( edgeMode = true, u[ 0 ] ) : l
				const	B = edgeDist[ 2 ] <= GRAB ? ( edgeMode = true, u[ 1 ] ) : b
				const	R = edgeDist[ 3 ] <= GRAB ? ( edgeMode = true, u[ 0 ] ) : r
				if	( edgeMode ) {
					const	scaleX	= ( R - L ) / ( r - l || 1 )
					const	scaleY	= ( B - T ) / ( b - t || 1 )
					const	tX = L - l * scaleX
					const	tY = T - t * scaleY
					app.reforms.forEach(
						( [ ID, S ] ) => {
							const	[ t, l, b, r ] = TLBR( FindNode( ID )[ 1 ] )
							const	T = t * scaleY + tY
							const	L = l * scaleX + tX
							const	B = b * scaleY + tY
							const	R = r * scaleX + tX
							S.cX = ( L + R ) / 2
							S.cY = ( T + B ) / 2
							S.rH = ( R - L ) / 2
							S.rV = ( B - T ) / 2
						}
					)
				}
				return	this.DrawReforms()
			}
		,	commit	: async () => {
				await Reform()
				this.setEditorToLargestReform()
			}
		}
	}

	beginLink() {
		return	{
			draw	: ( c2D, d, u ) => {
				const	paint = LINK_EDITOR.PAINT.$
				c2D.save()
				c2D.strokeStyle = paint.stroke || 'dodgerblue'
				c2D.lineWidth = Number( paint.lineWidth || 2 )
				c2D.lineCap = paint.lineCap || 'butt'
				c2D.beginPath()
				c2D.moveTo( ...d )
				c2D.lineTo( ...u )
				c2D.stroke()
				c2D.restore()
			}
		,	commit	: async ( d, u ) => {
				const	F = Node_XY( d );	if	( F === null ) return
				const	T = Node_XY( u );	if	( T === null ) return
				const	[ , A, P ] = LINK_EDITOR.$
				const	$ = [ [ F[ 0 ], T[ 0 ] ], A, P ]
				await Link( $ )
				LINK_EDITOR.$	= $	//	reflect the just-created link in the editor
			}
		}
	}

	beginCreate() {
		return	{
			draw	: ( c2D, d, u ) => {
				const	paint = NODE_EDITOR.PAINT.$
				c2D.save()
				c2D.strokeStyle = paint.stroke || 'dodgerblue'
				c2D.lineWidth = Number( paint.lineWidth || 2 )
				c2D.lineCap = paint.lineCap || 'butt'
				c2D.strokeRect( ...XYWH_XYXY( [ d, u ] ) )
				c2D.restore()
			}
		,	commit	: async ( d, u ) => {
				const	[ S, P ] = NODE_EDITOR.$
				const	r = DivXY( DeltaXY( d, u ), 2 )
				const	c = AddXY( d, r )
				S.cX = c[ 0 ]
				S.cY = c[ 1 ]
				S.rH = r[ 0 ]
				S.rV = r[ 1 ]
				//	ask for the new node's id in a modal ( empty = auto-assign );
				//	Cancel / Esc aborts and creates nothing.
				const	id = await this.promptNodeId()
				if	( id === null ) return
				await Node( [ id, S, P ] )
				app.reforms[ 0 ] && this.setEditor( app.reforms[ 0 ] )
			}
		}
	}

	beginArea() {
		return	{
			draw	: ( c2D, d, u ) => {
				c2D.save()
				c2D.strokeStyle = 'lightgray'
				c2D.strokeRect( ...XYWH_XYXY( [ d, u ] ) )
				c2D.restore()
			}
		,	commit	: ( d, u ) => {
				const	tlbr = TLBR_XYXY( [ d, u ] )
				app.model.nodes.forEach(
					_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && this.registReform( _ )
				)
				return	this.DrawReforms()
			}
		}
	}

	async onMouseMove( ev ) {

		if	( this.panning ) {
			this.scrollLeft	-= ev.clientX - this.panning.x
			this.scrollTop	-= ev.clientY - this.panning.y
			this.panning.x	= ev.clientX
			this.panning.y	= ev.clientY
			return
		}

		UpdateHoverLabel( ev )

		if	( mouse[ 0 ] === null ) {
			this.hoverXY = [ ev.offsetX, ev.offsetY ]	//	remembered for refreshModeCursor
			this.reformer.style.cursor = this.spaceDown ? 'grab' : Cursor_EV( ev )
			return
		}
		//	NOTE: no `!ev.buttons` reset here — pointer capture guarantees
		//	pointerup / pointercancel, and a stray buttons:0 move that the browser
		//	emits just before pointerup would otherwise drop the drag before commit.

		const
		c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		mouse[ 1 ] = [ ev.offsetX, ev.offsetY ]
		if	( EqualXY( mouse[ 0 ], mouse[ 1 ] ) ) return

		await this.drag?.draw( c2D, mouse[ 0 ], mouse[ 1 ] )
	}

	async onMouseUp( ev ) {
		if	( this.panning ) {
			this.panning = null
			ev?.pointerId != null && this.reformer.releasePointerCapture?.( ev.pointerId )
			this.reformer.style.cursor = this.spaceDown ? 'grab' : Cursor_EV( ev )
			return
		}

		void ev

		const
		drag = this.drag
		this.drag = null

		const
		[ mouseD, mouseU ] = mouse
		mouse[ 0 ] = mouse[ 1 ] = null

		if	( mouseD === null || mouseU === null ) return
		if	( EqualXY( mouseD, mouseU ) ) return

		const
		c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		await drag?.commit( mouseD, mouseU )
	}
}

customElements.define( 'main-editor', MainEditor )

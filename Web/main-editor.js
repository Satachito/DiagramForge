import {
	Report
,	FindNode
,	FindReform
,	Reform
,	Node
,	Link
,	RemoveLink
,	Delete
,	Copy
,	Paste
,	CanvasSize
}	from './Application.js'

import {
	Redo
,	Undo
}	from './Jobs.js'

import {
	AE
}	from './DomUtils.js'

import {
	XYWH
,	TLBR
,	XYWH_TLBR
,	TLBR_XYXY
,	BBox
,	ContentBounds
,	RectPath2D
,	EllipsePath2D
,	RhombusPath2D
,	LinkPath2D
}	from './diagram-geometry.js'

import { drawLinkCanvas } from './link-draw.js'
import { parsePadding, parseLinePx, labelY } from './vector-export-common.js'

const
mouse			= [ null, null ]

let
mouseDrag		= null	//	'move' | 'resize'

//	px tolerance for grabbing a selection edge (resize handles) / click-selecting a node
const
GRAB			= 8

const
MinEdge			= ( tlbr, xy ) => Math.min( ...EdgeDist( tlbr, xy ) )

const
PointContains		= ( tlbr, xy ) => MinEdge( tlbr, xy ) >= 0

const
NodeInterior		= ( tlbr, xy ) => MinEdge( tlbr, xy ) > GRAB

const
SelectionGrab		= ( tlbr, xy ) => {
	const
	m = MinEdge( tlbr, xy )
	return	m > -GRAB && m <= GRAB
}

const
ClosestNodeWhere	= ( xy, pred ) => {
	let
	top = null
	,	best = Infinity
	for ( const node of app.model.nodes ) {
		const
		tlbr = TLBR( node[ 1 ] )
		if	( !pred( node, tlbr, xy ) ) continue
		const
		d = MinEdge( tlbr, xy )
		if	( d < best ) {
			best = d
			top = node
		}
	}
	return	top
}

const
SelectedMemberAt	= xy => ClosestNodeWhere(
	xy
,	( node, tlbr, p ) => FindReform( node[ 0 ] ) && PointContains( tlbr, p )
)

const
UnselectedAt		= xy => ClosestNodeWhere(
	xy
,	( node, tlbr, p ) => !FindReform( node[ 0 ] ) && PointContains( tlbr, p )
)

const
SelectionInteriorAt	= xy => {
	if	( !app.reforms.length ) return false
	const
	sel = BBox( app.reforms )
	return	MinEdge( sel, xy ) > GRAB
	&&	!UnselectedAt( xy )
}

const
SelectionGrabAt		= xy => app.reforms.length && SelectionGrab( BBox( app.reforms ), xy )

const
HitSelect		= xy => {
	//	Resize handles on the current selection win over any node underneath, so a
	//	selected box can be resized even when other nodes overlap its edge band
	//	(an icon inside a container, a container's children, adjacent boxes…).
	if	( SelectionGrabAt( xy ) )			return 'selectionGrab'
	const
	unsel = UnselectedAt( xy )
	if	( unsel ) {
		const
		tlbr = TLBR( unsel[ 1 ] )
		return NodeInterior( tlbr, xy ) ? 'nodeInside' : 'nodeGrab'
	}
	if	( SelectedMemberAt( xy ) )			return 'selected'
	if	( SelectionInteriorAt( xy ) )		return 'selectionInside'
	return	'none'
}

const
SelectionGrabCursor	= ( sel, xy ) => {
	const
	[ dT, dL, dB, dR ] = EdgeDist( sel, xy )
	,	top = dT <= GRAB
	,	bottom = dB <= GRAB
	,	left = dL <= GRAB
	,	right = dR <= GRAB
	if	( ( top && left ) || ( bottom && right ) )	return 'nwse-resize'
	if	( ( top && right ) || ( bottom && left ) )	return 'nesw-resize'
	if	( top || bottom )	return 'ns-resize'
	if	( left || right )	return 'ew-resize'
	return	'move'
}

const
XYWH_XYXY		= ( [ [ x, y ], [ X, Y ] ] ) => [ x, y, X - x, Y - y ]

const
XY_EV			= ev => [ ev.offsetX, ev.offsetY ]
const
AddXY			= ( [ X, Y ], [ x, y ] )	=> [ X + x, Y + y ]
const
DivXY			= ( [ X, Y ], _ )			=> [ X / _, Y / _ ]
const
EqualXY			= ( [ X, Y ], [ x, y ] )	=> X === x && Y === y
const
DeltaXY			= ( [ X, Y ], [ x, y ] )	=> [ x - X, y - Y ]

const
ContainsTLBR	= ( [ T, L, B, R ], [ t, l, b, r ] ) => T <= t && b <= B && L <= l && r <= R

const
EdgeDist		= ( [ T, L, B, R ], [ x, y ] ) => [
	y - T
,	x - L
,	B - y
,	R - x
]
//	min( ..._ )
//	Outside	: min( ...__ ) < -4
//	Edge	: -4 <= min( ...__ ) <= 0
//	Inside	: 0 < min( ..._ )

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
		const	lineWidth		= P[ 'lineWidth'		]; lineWidth		&& ( c2D.lineWidth		= lineWidth			)
		const	lineCap			= P[ 'lineCap'			]; lineCap			&& ( c2D.lineCap		= lineCap			)
		const	lineJoin		= P[ 'lineJoin'			]; lineJoin			&& ( c2D.lineJoin		= lineJoin			)
		const	lineDash		= P[ 'lineDash'			]; c2D.setLineDash( lineDash?.length ? lineDash : [] )
		const	lineDashOffset	= P[ 'lineDashOffset'	]; lineDashOffset	&& ( c2D.lineDashOffset	= lineDashOffset	)
		const	miterLimit		= P[ 'miterLimit'		]; miterLimit		&& ( c2D.miterLimit		= miterLimit		)
		c2D.strokeStyle = stroke
		c2D.stroke( path )
	}
	c2D.restore()
}

const
parseStyle		= style => {
	const	out = {}
	if	( !style ) return out
	style.replace( /\n/g, '' ).split( ';' ).forEach(
		part => {
			const
			i = part.indexOf( ':' )
			if	( i < 0 ) return
			const
			key = part.slice( 0, i ).trim().toLowerCase()
			,	val = part.slice( i + 1 ).trim()
			key && val && ( out[ key ] = val )
		}
	)
	return	out
}

const
decodeHtml		= html => {
	const	$ = document.createElement( 'textarea' )
	$.innerHTML = html
	return	$.value
}

const
wrapLines		= ( c2D, text, maxWidth ) => {
	const
	lines = []
	text.split( /\n|<br\s*\/?>/i ).forEach(
		paragraph => {
			const
			words = paragraph.trim().split( /\s+/ ).filter( Boolean )
			if	( !words.length ) {
				lines.push( '' )
				return
			}
			let
			line = words[ 0 ]
			for	( let i = 1; i < words.length; i++ ) {
				const
				next = `${ line } ${ words[ i ] }`
				if	( c2D.measureText( next ).width > maxWidth && line ) {
					lines.push( line )
					line = words[ i ]
				} else	line = next
			}
			lines.push( line )
		}
	)
	return	lines.length ? lines : [ '' ]
}

const
DrawHtmlLabel	= ( c2D, S ) => {
	const
	st = parseStyle( S.style )
	,	fontSize = parseFloat( st[ 'font-size' ] ) || 12
	,	fontWeight = st[ 'font-weight' ] || 'normal'
	,	fontFamily = st[ 'font-family' ] || 'courier, monospace'
	,	textAlign = ( () => {
			//	explicit text-align wins; else derive horizontal from the
			//	flex/grid justify-*; else HTML block default = left.
			const	t = st[ 'text-align' ]
			if	( t ) return t
			const	j = st[ 'justify-items' ] || st[ 'justify-content' ] || st[ 'place-items' ] || ''
			return /center/.test( j ) ? 'center' : /end/.test( j ) ? 'right' : 'left'
		} )()
	,	[ x, y, w, h ] = XYWH( S )
	,	{ t: padT, r: padR, b: padB, l: padL } = parsePadding( st )
	,	innerW = Math.max( 0, w - padL - padR )
	,	color = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
	,	middle = st[ 'text-baseline' ] === 'middle'

	c2D.save()
	c2D.fillStyle = color
	c2D.font = `${ fontWeight } ${ fontSize }px ${ fontFamily }`
	c2D.textAlign = textAlign === 'right' ? 'right' : textAlign === 'left' ? 'left' : 'center'
	c2D.textBaseline = middle ? 'middle' : 'alphabetic'

	const
	lines = wrapLines( c2D, decodeHtml( S.html ), innerW )
	,	linePx = parseLinePx( st, fontSize )
	,	blockH = lines.length * linePx
	,	alignItems = st[ 'align-items' ] || st[ 'place-items' ] || 'start'
	,	startY = labelY( { y, h, blockH, linePx, fontSize, padT, padB, alignItems, middle } )

	const
	textX = textAlign === 'right'
	?	x + w - padR
	:	textAlign === 'left'
	?	x + padL
	:	x + w / 2

	lines.forEach(
		( line, i ) => c2D.fillText( line, textX, startY + i * linePx )
	)
	c2D.restore()
}

const
Node_XY		= xy => ClosestNodeWhere(
	xy
,	( _, tlbr, p ) => PointContains( tlbr, p )
)

const
UpdateHoverLabel = ev => {
	const
	node = Node_XY( XY_EV( ev ) )
	if ( !node ) {
		UNDER_HOVER.style.display = 'none'
		return
	}
	UNDER_HOVER.textContent		= node[ 0 ]
	UNDER_HOVER.style.display	= 'block'
	UNDER_HOVER.style.left		= `${ ev.clientX + 12 }px`
	UNDER_HOVER.style.top		= `${ Math.max( 8, ev.clientY - 28 ) }px`
}


export default class
MainEditor extends HTMLElement {

	Draw() {
		this.ApplyCanvasSize()
		window.EMPTY_HINT && ( window.EMPTY_HINT.style.display = app.model.nodes.length ? 'none' : '' )
		return Promise.all( [ this.DrawNodes(), this.DrawReforms() ] ).catch( Report )
	}

	clearInteraction() {
		mouse[ 0 ] = mouse[ 1 ] = null
		mouseDrag = null
	}

	ApplyCanvasSize() {
		const
		[ w, h ] = CanvasSize()
		if	( !( w > 0 && h > 0 ) )	throw new Error( `Invalid canvas size: ${ w }×${ h }` )
		this.drawer.width		= this.reformer.width		= w
		this.drawer.height		= this.reformer.height		= h
	}

	async DrawNodes() {
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
					console.log( 'Unknown:', S.type )
					break
				}
				if	( S.html )	DrawHtmlLabel( c2D, S )
			} catch ( er ) {
				console.error( 'DrawNodes failed:', ID, er )
			}
		}

		//	guard: FindNode may return undefined if a link references a deleted node
		app.model.links.forEach(
			( [ [ F, A, T ], P ] ) => {
				const	nF = FindNode( F )
				const	nT = FindNode( T )
				nF && nT && drawLinkCanvas( c2D, nF[ 1 ], A, nT[ 1 ], P )
			}
		)
	}

	async DrawReforms() {
		const	c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		for ( const [ [ F, A, T ], S ] of app.model.links ) {
			const	rF = FindReform( F )
			const	rT = FindReform( T )
			rF && rT && drawLinkCanvas( c2D, rF[ 1 ], A, rT[ 1 ], S )
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
			//	resize handles: 4 corners + 4 edge midpoints
			const	hMX = ( hL + hR ) / 2, hMY = ( hT + hB ) / 2, HS = 8
			c2D.fillStyle = '#ffffff'
			c2D.lineWidth = 1.5
			for ( const [ hx, hy ] of [
				[ hL, hT ], [ hMX, hT ], [ hR, hT ]
			,	[ hL, hMY ],              [ hR, hMY ]
			,	[ hL, hB ], [ hMX, hB ], [ hR, hB ]
			] ) {
				c2D.fillRect( hx - HS / 2, hy - HS / 2, HS, HS )
				c2D.strokeRect( hx - HS / 2, hy - HS / 2, HS, HS )
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
		this.linkMenuKey			= null

		this.hideLinkMenu			= () => (
			LINK_MENU.style.display	= 'none'
		,	this.linkMenuKey		= null
		)

		LINK_MENU_REMOVE.onclick	= ev => (
			ev.stopPropagation()
		,	this.linkMenuKey && RemoveLink( this.linkMenuKey[ 0 ], this.linkMenuKey[ 2 ] )
		,	this.hideLinkMenu()
		,	this.reformer.focus()
		)

		//	window-level: catches clicks outside main-editor too
		//	capture(true): runs before stopPropagation() in LINK_MENU_REMOVE.onclick
		addEventListener( 'pointerdown', ev => {
			if	( LINK_MENU.style.display === 'none' ) return
			if	( LINK_MENU.contains( ev.target ) ) return
			this.hideLinkMenu()
		}, true )

		this.reformer.oncontextmenu	= ev => {
			const
			c2D = this.reformer.getContext( '2d' )
			const
			XY = XY_EV( ev )
			const
			findLinkKeyAt	= () => {
				for	( let i = app.model.links.length; i--; ) {
					const	[ [ F, A, T ], P ] = app.model.links[ i ]
					const	nF		= FindNode( F )
					const	nT		= FindNode( T )
					if	( ! nF || ! nT ) continue
					const	path	= LinkPath2D( nF[ 1 ], A, nT[ 1 ] )
					c2D.lineWidth	= Math.max( Number( P.lineWidth || 4 ), 10 )
					c2D.lineCap		= P.lineCap		|| 'butt'
					c2D.lineJoin	= P.lineJoin	|| 'miter'
					if	( P.stroke	&& c2D.isPointInStroke( path, ...XY ) )	return [ F, A, T ]
					if	( P.fill	&& c2D.isPointInFill( path, ...XY ) )	return [ F, A, T ]
				}
				return null
			}
			const
			key = findLinkKeyAt()
			if	( ! key ) return
			ev.preventDefault()
			this.linkMenuKey		= key
			LINK_MENU.style.display	= 'block'
			const	pad	= 8
			const	w	= LINK_MENU.offsetWidth		|| 120
			const	h	= LINK_MENU.offsetHeight	|| 40
			LINK_MENU.style.left	= `${ Math.max( pad, Math.min( ev.clientX, innerWidth - w - pad ) ) }px`
			LINK_MENU.style.top		= `${ Math.max( pad, Math.min( ev.clientY, innerHeight - h - pad ) ) }px`
		}
		this.reformer.oncopy = ev => (
			ev.preventDefault()
		,	Copy( ev.clipboardData )
		)
		this.reformer.oncut = ev => (
			this.reformer.oncopy( ev )
		,	Delete()
		)
		this.reformer.onpaste = ev => (
			ev.preventDefault()
		,	Paste( ev.clipboardData )
		)

		//	window-level so shortcuts work without the canvas being focused,
		//	but never while the user is typing in a form field.
		let
		modeBeforeModifier = null

		const
		UpdateModeCursor = () => {
			this.reformer.style.cursor = MODE_TOOL.value === 'select' ? 'default' : 'crosshair'
		}

		const
		SyncModeSelector = ev => {
			const	t = ev.target
			if	( t && ( /^(INPUT|TEXTAREA|SELECT)$/.test( t.tagName ) || t.isContentEditable ) ) return

			if	( ev.metaKey || ev.altKey ) {
				const
				next = ev.metaKey ? 'node' : 'link'
				modeBeforeModifier === null && ( modeBeforeModifier = MODE_TOOL.value )
				if	( MODE_TOOL.value !== next ) {
					MODE_TOOL.value = next
					UpdateModeCursor()
				}
			} else if	( modeBeforeModifier !== null ) {
				MODE_TOOL.value = modeBeforeModifier
				modeBeforeModifier = null
				UpdateModeCursor()
			}
		}

		addEventListener( 'keydown', async ev => {
			SyncModeSelector( ev )
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
				if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await SelectAll() }
				break
			case 'e':	case 'E':
				if ( ev.metaKey || ev.ctrlKey ) { ev.preventDefault(); await Expand() }
				break
			case 'Escape':
				mouse[ 0 ] = mouse[ 1 ] = null
				mouseDrag = null
				this.hideLinkMenu()
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
		} )

		addEventListener( 'keyup', ev => SyncModeSelector( ev ) )

		addEventListener( 'blur', () => {
			if	( modeBeforeModifier === null ) return
			MODE_TOOL.value = modeBeforeModifier
			modeBeforeModifier = null
			UpdateModeCursor()
		} )

		this.reformer.onmouseleave = () => (
			UNDER_HOVER.style.display = 'none'
		,	mouse[ 0 ] = null
		,	mouse[ 1 ] = null
		)

		const
		Mode = ev => {
			if	( ev.metaKey	) return 'node'
			if	( ev.altKey		) return 'link'
			return MODE_TOOL.value	//	select, node, link
		}

		const
		CursorAt = ev => {
			if	( Mode( ev ) !== 'select' ) return 'crosshair'
			const
			xy = XY_EV( ev )
			switch ( HitSelect( xy ) ) {
			case 'selected':
			case 'selectionInside':
			case 'nodeInside':
			case 'nodeGrab':
				return 'move'
			case 'selectionGrab':
				return SelectionGrabCursor( BBox( app.reforms ), xy )
			default:
				return 'default'
			}
		}

		const
		RegistReform	= _ => FindReform( _[ 0 ] ) || app.reforms.push( structuredClone( _ ) )

		const
		RollSelectedToTop	= () => app.model.nodes.forEach(
			$ => app.reforms.find( _ => _[ 0 ] === $[ 0 ] ) && (
				app.model.nodes = app.model.nodes.filter( _ => _ !== $ )
			,	app.model.nodes.push( $ )
			)
		)

		const
		SelectAll	= async () => {
			app.reforms = app.model.nodes.map( _ => structuredClone( _ ) )
			await this.DrawReforms()
		}

		//	plain click: select just the one node, replacing any selection
		const
		SelectSingle	= async node => {
			SHAPE_EDITOR.$ = node[ 1 ]
			PAINT_EDITOR.$ = node[ 2 ]
			RegistReform( node )
			RollSelectedToTop()
			await this.DrawReforms()
		}

		//	shift+click: extend the selection with the node and everything it contains
		const
		AddWithContained	= async node => {
			SHAPE_EDITOR.$ = node[ 1 ]
			PAINT_EDITOR.$ = node[ 2 ]
			const
			tlbr = TLBR( node[ 1 ] )
			RegistReform( node )
			app.model.nodes.forEach(
				_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && RegistReform( _ )
			)
			RollSelectedToTop()
			await this.DrawReforms()
		}

		//	E key: expand the current selection to include everything it contains
		//	(a node with nothing inside it simply stays as-is). Selection only,
		//	so it is not part of the undo history.
		const
		Expand	= async () => {
			if	( !app.reforms.length ) return
			app.reforms.slice().forEach(
				reform => {
					const
					node = FindNode( reform[ 0 ] )
					if	( !node ) return
					const
					tlbr = TLBR( node[ 1 ] )
					app.model.nodes.forEach(
						_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && RegistReform( _ )
					)
				}
			)
			RollSelectedToTop()
			await this.DrawReforms()
		}

		this.reformer.onmousedown = async ev => {
			this.reformer.tabIndex = 0

			if	( ev.button ) return

			const
			xy	= mouse[ 0 ] = XY_EV( ev )

			if	( Mode( ev ) != 'select' ) return

			//	link hit-test (returns both endpoints); used by plain and shift paths
			const
			linkEndpointsAt	= () => {
				let	$ = null
				app.model.links.forEach(
					( [ [ F, A, T ], P ] ) => {
						const
						[ nF, nT ]	= [ FindNode( F ), FindNode( T ) ]
						nF && nT && this.reformer.getContext( '2d' ).isPointInPath( LinkPath2D( nF[ 1 ], A, nT[ 1 ] ), ...xy ) && (
							$ = [ nF, nT, [ F, A, T ] ]
						)
					}
				)
				return	$
			}
			const
			RegistLink	= link => (
				RegistReform( link[ 0 ] )
			,	RegistReform( link[ 1 ] )
			,	LINK_EDITOR.$ = link[ 2 ]
			)

			//	Shift+click extends the selection: add the node under the cursor plus
			//	everything it contains (or a link's two endpoints), keeping the rest.
			if	( ev.shiftKey ) {
				mouseDrag = 'move'
				const
				node = UnselectedAt( xy ) || SelectedMemberAt( xy )
				if	( node ) {
					await AddWithContained( node )
				} else {
					const	link = linkEndpointsAt()
					link && RegistLink( link )
					await this.DrawReforms()
				}
				return
			}

			switch ( HitSelect( xy ) ) {
			case 'selectionGrab':
				mouseDrag = 'resize'
				return
			case 'selected':
			case 'selectionInside':
				//	inside the current selection: keep it, drag moves all
				mouseDrag = 'move'
				await this.DrawReforms()
				return
			}

			//	plain click on a node / link / empty space replaces the selection
			app.reforms = []
			const
			link = linkEndpointsAt()
			if	( link ) {
				mouseDrag = 'move'
				RegistLink( link )
				await this.DrawReforms()
				return
			}
			const
			node = UnselectedAt( xy )
			if	( node ) {
				mouseDrag = 'move'
				await SelectSingle( node )
				return
			}
			mouseDrag = null
			await this.DrawReforms()
		}

		this.reformer.onmousemove = async ev => {

			UpdateHoverLabel( ev )

			if	( mouse[ 0 ] === null ) {
				this.reformer.style.cursor = CursorAt( ev )
				return
			}
			//	mouseleave may be missed on fast movement — reset if button already released
			if	( !ev.buttons ) {
				mouse[ 0 ] = mouse[ 1 ] = null
				mouseDrag = null
				return
			}

			const
			c2D = this.reformer.getContext( '2d' )
			c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

			mouse[ 1 ] = [ ev.offsetX, ev.offsetY ]
			if	( EqualXY( mouse[ 0 ], mouse[ 1 ] ) ) return

			switch	( Mode( ev ) ) {
			case 'link':
				{	const
					_ = PAINT_EDITOR.$
					c2D.save()
					c2D.strokeStyle = _.stroke || 'dodgerblue'
					c2D.lineWidth = Number( _.lineWidth || 2 )
					c2D.lineCap = _.lineCap || 'butt'
					c2D.beginPath()
					c2D.moveTo( ...mouse[ 0 ] )
					c2D.lineTo( ...mouse[ 1 ] )
					c2D.stroke()
					c2D.restore()
				}
				return
			case 'node':
				{	const
					_ = PAINT_EDITOR.$
					c2D.save()
					c2D.strokeStyle = _.stroke || 'dodgerblue'
					c2D.lineWidth = Number( _.lineWidth || 2 )
					c2D.lineCap = _.lineCap || 'butt'
					c2D.strokeRect( ...XYWH_XYXY( mouse ) )
					c2D.restore()
				}
				return
			}

			if	( app.reforms.length ) {
				if	( mouseDrag === 'resize' ) {
					let		edgeMode = false

					const	tlbr = BBox( app.reforms.map( _ => FindNode( _[ 0 ] ) ) )
					const	edgeDist = EdgeDist( tlbr, mouse[ 0 ] )
					const	[ t, l, b, r ] = tlbr
					const	T = edgeDist[ 0 ] <= GRAB ? ( edgeMode = true, mouse[ 1 ][ 1 ] ) : t
					const	L = edgeDist[ 1 ] <= GRAB ? ( edgeMode = true, mouse[ 1 ][ 0 ] ) : l
					const	B = edgeDist[ 2 ] <= GRAB ? ( edgeMode = true, mouse[ 1 ][ 1 ] ) : b
					const	R = edgeDist[ 3 ] <= GRAB ? ( edgeMode = true, mouse[ 1 ][ 0 ] ) : r

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
				} else {
					const	[ dX, dY ] = DeltaXY( ...mouse )
					app.reforms.forEach(
						( [ ID, S ] ) => {
							const	s = FindNode( ID )[ 1 ]
							S.cX = s.cX + dX
							S.cY = s.cY + dY
						}
					)
				}
				await this.DrawReforms()
			} else {
				c2D.save()
				c2D.strokeStyle = 'lightgray'
				c2D.strokeRect( ...XYWH_XYXY( mouse ) )
				c2D.restore()
			}
		}

		this.reformer.onmouseup = async ev => {
			const
			[ mouseD, mouseU ] = mouse
			mouse[ 0 ] = mouse[ 1 ] = null
			mouseDrag = null
			if	( mouseD === null || mouseU === null ) return
			if	( EqualXY( mouseD, mouseU ) ) return

			const
			c2D = this.reformer.getContext( '2d' )
			c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

			switch	( Mode( ev ) ) {
			case 'link':
				{	const	F = Node_XY( mouseD );	if	( F === null ) return
					const	T = Node_XY( mouseU );	if	( T === null ) return
					const	[ _F, A, _T ] = LINK_EDITOR.$
					const	$ = [ [ F[ 0 ], A, T[ 0 ] ], PAINT_EDITOR.$ ]
					await Link( $ )
				}
				return
			case 'node':
				{	const	S = SHAPE_EDITOR.$
					const	r = DivXY( DeltaXY( mouseD, mouseU ), 2 )
					const	c = AddXY( mouseD, r )
					S.cX = c[ 0 ]
					S.cY = c[ 1 ]
					S.rH = r[ 0 ]
					S.rV = r[ 1 ]
					await Node( [ NODE_ID.value, S, PAINT_EDITOR.$ ] )
				}
				return
			}

			if	( app.reforms.length ) {
				await Reform()
			} else {	//	Make selection or Creation
				const
				tlbr = TLBR_XYXY( [ mouseD, mouseU ] )
				app.model.nodes.forEach(
					_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && RegistReform( _ )
				)
				await this.DrawReforms()
			}
		}

		matchMedia( '(prefers-color-scheme: dark)' ).addEventListener(
			'change'
		,	() => this.Draw()
		)
	}

	async	exportCanvas( pad = 32 ) {
		this.ApplyCanvasSize()
		await this.DrawNodes()

		const
		[ cw, ch ] = CanvasSize()
		if	( !app.model.nodes.length ) {
			const
			out = document.createElement( 'canvas' )
			out.width = cw
			out.height = ch
			const
			c2D = out.getContext( '2d' )
			c2D.fillStyle = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#000000' : '#ffffff'
			c2D.fillRect( 0, 0, cw, ch )
			c2D.drawImage( this.drawer, 0, 0 )
			return out
		}

		const
		{ x, y, width, height } = ContentBounds( app.model.nodes, pad, CanvasSize )
		const
		out = document.createElement( 'canvas' )
		out.width = width
		out.height = height
		const
		c2D = out.getContext( '2d' )
		c2D.fillStyle = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#000000' : '#ffffff'
		c2D.fillRect( 0, 0, width, height )
		c2D.drawImage( this.drawer, x, y, width, height, 0, 0, width, height )
		return out
	}
}

customElements.define( 'main-editor', MainEditor )

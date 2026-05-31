import {
	FindNode
,	FindReform
,	Reform
,	Node
,	Link
,	RemoveLink
,	Delete
,	Copy
,	Paste
}	from './Application.js'

import {
	Redo
,	Undo
}	from './Jobs.js'

import {
	AE
}	from './DomUtils.js'

const	
mouse			= [ null, null ]

const
XYWH			= ( { cX, cY, rH, rV } ) => [ cX - rH, cY - rV, rH + rH, rV + rV ]

const
T				= ( { cX, cY, rH, rV } ) => rV > 0 ? cY - rV : cY + rV
const
B				= ( { cX, cY, rH, rV } ) => rV > 0 ? cY + rV : cY - rV
const
L				= ( { cX, cY, rH, rV } ) => rH > 0 ? cX - rH : cX + rH
const
R				= ( { cX, cY, rH, rV } ) => rH > 0 ? cX + rH : cX - rH

//const
//TLBR			= S => [ T( S ), L( S ), B( S ), R( S ) ]
//	OPTIMIZED
const
TLBR			= ( { cX, cY, rH, rV } ) => 0 < rH
?	0 < rV
	?	[ cY - rV, cX - rH, cY + rV, cX + rH ]
	:	[ cY + rV, cX - rH, cY - rV, cX + rH ]
:	0 < rV
	?	[ cY - rV, cX + rH, cY + rV, cX - rH ]
	:	[ cY + rV, cX + rH, cY - rV, cX - rH ]
;


const
XYWH_TLBR		= ( [ T, L, B, R ] ) => [ L, T, R - L, B - T ]
const
XYWH_XYXY		= ( [ [ x, y ], [ X, Y ] ] ) => [ x, y, X - x, Y - y ]
const
TLBR_XYXY		= ( [ [ x, y ], [ X, Y ] ] ) => [
	y < Y ? y : Y
,	x < X ? x : X
,	y < Y ? Y : y
,	x < X ? X : x
]

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
ContainsXY		= ( [ T, L, B, R ], [ x, y ] ) => T <= y && y <= B && L <= x && x <= R
const
ContainsTLBR	= ( [ T, L, B, R ], [ t, l, b, r ] ) => T <= t && b <= B && L <= l && r <= R
const
ContersectsTLBR	= ( [ T, L, B, R ], [ t, l, b, r ] ) => {
	if	( R < l || r < L || ( l < L && R < r ) ) return false
	if	( B < t || b < T || ( t < T && B < b ) ) return false
	return true
}

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
Union			= ( [ T, L, B, R ], [ t, l, b, r ] ) => [
	T < t ? T : t
,	L < l ? L : l
,	b < B ? B : b
,	r < R ? R : r
]

const
RectPath2D		= S => {
	const	$ = new Path2D
	$.roundRect( ...XYWH( S ), S.radii ?? 0 )
	return	$
}
const
EllipsePath2D	= ( { cX, cY, rH, rV } ) => {
	const	$ = new Path2D
	$.ellipse( cX, cY, rH, rV, 0, 0, 2 * Math.PI )
	return	$
}
const
RhombusPath2D	= ( { cX, cY, rH, rV } ) => {
	const	$ = new Path2D
	$.moveTo( cX, cY - rV )
	$.lineTo( cX + rH, cY )
	$.lineTo( cX, cY + rV )
	$.lineTo( cX - rH, cY )
	$.closePath()
	return	$
}

const
LinkCoordinates	= ( sF, aF, sT, aT ) => {
	const
	$ = ( S, A, s, a ) => {
		switch	( A ) {
		case "TL"	: return [ L( S ), T( S ) ]
		case "TR"	: return [ R( S ), T( S ) ]
		case "BL"	: return [ L( S ), B( S ) ]
		case "BR"	: return [ R( S ), B( S ) ]
		case "T"	: switch	( a ) {
			case "TL"	: return [ L( s )	, T( S )	]
			case "TR"	: return [ R( s )	, T( S )	]
			case "BL"	: return [ L( s )	, T( S )	]
			case "BR"	: return [ R( s )	, T( S )	]
			default		: return [ S.cX		, T( S )	]
			}
		case "L"	: switch	( a ) {
			case "TL"	: return [ L( S )	, T( s )	]
			case "TR"	: return [ L( S )	, T( s )	]
			case "BL"	: return [ L( S )	, B( s )	]
			case "BR"	: return [ L( S )	, B( s )	]
			default		: return [ L( S )	, S.cY		]
			}
		case "B"	: switch	( a ) {
			case "TL"	: return [ L( s )	, B( S )	]
			case "TR"	: return [ R( s )	, B( S )	]
			case "BL"	: return [ L( s )	, B( S )	]
			case "BR"	: return [ R( s )	, B( S )	]
			default		: return [ S.cX		, B( S )	]
			}
		case "R"	: switch	( a ) {
			case "TL"	: return [ R( S )	, T( s )	]
			case "TR"	: return [ R( S )	, T( s )	]
			case "BL"	: return [ R( S )	, B( s )	]
			case "BR"	: return [ R( S )	, B( s )	]
			default		: return [ R( S )	, S.cY		]
			}
		default:
			{	const	dX = s.cX - S.cX
				const	dY = s.cY - S.cY
				if	( !dX && !dY ) return [ S.cX, S.cY ]
				const	sH = dX ? Math.abs( S.rH / dX ) : Infinity
				const	sV = dY ? Math.abs( S.rV / dY ) : Infinity
				const	$ = sH < sV ? sH : sV
				return	[ S.cX + dX * $, S.cY + dY * $ ]
			}
		}
	}
	return [
		$( sF, aF, sT, aT )
	,	$( sT, aT, sF, aF )
	]
}

/*	Horizontal canonical link shaft + affine map to segment pA → pB	*/
const
LinkPath2D		= ( shapeF, { headF, headT, anchorF, anchorT }, shapeT ) => {
	const	[ [ pFX, pFY ], [ pTX, pTY ] ] = LinkCoordinates( shapeF, anchorF, shapeT, anchorT )
	const	dX = pTX - pFX
	const	dY = pTY - pFY
	const	len = Math.hypot( dX, dY )
	const	$ = new Path2D
	if	( len < 1 ) return $

	const	headLen = Math.min( 14, len * 0.35 )
	const	headHalf = Math.max( 5, headLen * 0.5 )
	const	shaftHalf = Math.max( 2, headHalf * 0.45 )

	const	fNeckX = headF ? headLen : 0
	const	tNeckX = len - ( headT ? headLen : 0 )
	const	points = []
	if	( headF ) {
		points.push( [ 0, 0 ] )
		points.push( [ fNeckX, headHalf ] )
		points.push( [ fNeckX, shaftHalf ] )
	} else {
		points.push( [ 0, shaftHalf ] )
	}
	points.push( [ tNeckX, shaftHalf ] )
	if	( headT ) {
		points.push( [ tNeckX, headHalf ] )
		points.push( [ len, 0 ] )
		points.push( [ tNeckX, -headHalf ] )
	} else {
		points.push( [ len, shaftHalf ] )
		points.push( [ len, -shaftHalf ] )
	}
	points.push( [ tNeckX, -shaftHalf ] )
	points.push( [ fNeckX, -shaftHalf ] )
	if	( headF ) {
		points.push( [ fNeckX, -headHalf ] )
	} else {
		points.push( [ 0, -shaftHalf ] )
	}

	const	toW = ( lx, ly ) => [
		pFX + lx * ( dX / len ) - ly * ( dY / len )
	,	pFY + lx * ( dY / len ) + ly * ( dX / len )
	]

	const	[ x0, y0 ] = toW( ...points[ 0 ] )
	$.moveTo( x0, y0 )
	for	( let i = 1; i < points.length; i++ ) {
		const	[ wx, wy ] = toW( ...points[ i ] )
		$.lineTo( wx, wy )
	}
	$.closePath()
	return	$
}

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
		const	lineDash		= P[ 'lineDash'			]; lineDash			&& ( c2D.lineDash		= lineDash			)
		const	lineDashOffset	= P[ 'lineDashOffset'	]; lineDashOffset	&& ( c2D.lineDashOffset	= lineDashOffset	)
		const	miterLimit		= P[ 'miterLimit'		]; miterLimit		&& ( c2D.miterLimit		= miterLimit		)
		c2D.strokeStyle = stroke
		c2D.stroke( path )
	}
	c2D.restore()
}

const
escapeXml	= _ => String( _ )
.	replace( /&/g, '&amp;' )
.	replace( /</g, '&lt;' )
.	replace( />/g, '&gt;' )

const
Node_XY		= ( [ x, y ] ) => {
	const
	drafts = []
	app.model.nodes.forEach(
		E => {
			const	[ T, L, B, R ] = TLBR( E[ 1 ] )
			T < y && y < B && L < x && x < R && drafts.push(
				[	E
				,	Math.min( y - T, x - L, B - y, R - x )
				]
			)
		}
	)
	switch	( drafts.length ) {
	case 0:	
		return null
	case 1:		//	Do Nothing
		return drafts[ 0 ][ 0 ]
	}
	return drafts.slice( 1 ).reduce(
		( $, _ ) => $[ 1 ] < _[ 1 ] ? $ : _
	,	drafts[ 0 ]
	)[ 0 ]
}

const
BBox		= _ => _.slice( 1 ).reduce(
	( $, _ ) => Union( $, TLBR( _[ 1 ] ) )
,	TLBR( _[ 0 ][ 1 ] )
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
		Promise.all( [ this.DrawNodes(), this.DrawReforms() ] ).catch( Report )
	}

	async DrawNodes() {
		const	c2D = this.drawer.getContext( '2d' )

		const
		drawSVG		= async ( svg, S ) => {
			const	url = URL.createObjectURL(
				new Blob(
					svg
				,	{ type: 'image/svg+xml;charset=utf-8' }
				)
			)
			try {
				const	image = new Image()
				image.src = url
				if	( image.decode ) {
					await image.decode()
				} else {
					await new Promise(
						( S, J ) => (
							image.onload = () => S()
						,	image.onerror = () => J( new Error( 'SVG: loading failed' ) )
						)
					)
				}
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
				if	( S.html ) {
					const	color = matchMedia( '(prefers-color-scheme: dark)' ).matches
					?	'#ffffff'
					:	'#000000'
					const	style = `width:100%;height:100%;box-sizing:border-box;color-scheme:light dark;color:${ color };${ S.style }`
					const	[ w, h ] = [ S.rH * 2, S.rV * 2 ]
					await drawSVG(
						[	`<svg xmlns="http://www.w3.org/2000/svg" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }">
								<foreignObject x="0" y="0" width="100%" height="100%">
								<div xmlns="http://www.w3.org/1999/xhtml" style="${ escapeXml( style ) }">
								${ escapeXml( S.html ) }
							</div></foreignObject></svg>`
						]
					,	S
					)
				}
			} catch ( er ) {
				console.error( 'DrawNodes failed:', ID, er )
			}
		}

		//	guard: FindNode may return undefined if a link references a deleted node
		app.model.links.forEach(
			( [ [ F, A, T ], P ] ) => {
				const	nF = FindNode( F )
				const	nT = FindNode( T )
				nF && nT && DrawPath( c2D, LinkPath2D( nF[ 1 ], A, nT[ 1 ] ), P )
			}
		)
	}

	async DrawReforms() {
		const	c2D = this.reformer.getContext( '2d' )
		c2D.clearRect( 0, 0, this.reformer.width, this.reformer.height )

		for ( const [ [ F, A, T ], S ] of app.model.links ) {
			const	rF = FindReform( F )
			const	rT = FindReform( T )
			rF && rT && DrawPath(
				c2D
			,	LinkPath2D( rF[ 1 ], A, rT[ 1 ] )
			,	S
			)
		}

		if	( app.reforms.length ) {
			c2D.save()
			c2D.strokeStyle = '#00ffff'
			c2D.lineWidth = 4
			for ( const [ , S ] of app.reforms ) c2D.strokeRect( ...XYWH( S ) )
			c2D.strokeStyle = '#ff0000'
			c2D.lineWidth = 2
			c2D.strokeRect( ...XYWH_TLBR( BBox( app.reforms ) ) )
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
		this.drawer.width			= this.reformer.width			= 4096
		this.drawer.height			= this.reformer.height			= 4096
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

		this.reformer.onkeydown = async ev => {
			switch ( ev.key ) {
			case 'z':	case 'Z':
				if ( ev.metaKey || ev.ctrlKey ) await ( ev.shiftKey ? Redo() : Undo() )
				break
			case 'y':	case 'Y':
				if ( ev.metaKey || ev.ctrlKey ) await Redo()
				break
			case 'Escape':
				console.log( ev )
				mouse = [ null, null ]
				this.hideLinkMenu()
				await this.DrawReforms()
				break
			case 'Backspace':
				await Delete()
				break
			default:
				break
			}
		}

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
		RegistReform	= _ => FindReform( _[ 0 ] ) || app.reforms.push( structuredClone( _ ) )

		this.reformer.onmousedown = async ev => {
			this.reformer.tabIndex = 0

			if	( ev.button ) return

			const
			xy	= mouse[ 0 ] = [ ev.offsetX, ev.offsetY ]

			if	( Mode( ev ) != 'select' ) return
			
			if	( app.reforms.length && Math.min( ...EdgeDist( BBox( app.reforms ), xy ) ) > -4 ) {
//	console.log( 'Selection clicked' )
				const
				tlbr = TLBR( app.reforms[ 0 ][ 1 ] )

				switch ( ev.detail % 6 ) {
				case 1:
					break
				case 2:
					app.reforms.splice( 1 )
					break
				case 3:
					app.model.nodes.forEach(
						_ => ContersectsTLBR( tlbr, TLBR( _[ 1 ] ) ) && RegistReform( _ )
					)
					break
				case 4:
					app.model.nodes.forEach(
						_ => ContainsTLBR( TLBR( _[ 1 ] ), tlbr ) && RegistReform( _ )
					)
					break
				case 5:
					app.model.nodes.forEach(
						_ => ContersectsTLBR( TLBR( _[ 1 ] ), tlbr ) && RegistReform( _ )
					)
					break
				default:
					app.model.nodes.forEach( _ => RegistReform( _ ) )
					break
				}
				await this.DrawReforms()
				return
			}

			app.reforms = []

			app.model.links.forEach(
				( [ [ F, A, T ], P ] ) => {
					const
					[ nF, nT ]	= [ FindNode( F ), FindNode( T ) ]
					this.reformer.getContext( '2d' ).isPointInPath( LinkPath2D( nF[ 1 ], A, nT[ 1 ] ), ...xy ) && (
						RegistReform( nF )
					,	RegistReform( nT )
					,	LINK_EDITOR.$ = [ F, A, T ]
					)
				}
			)
			if	( app.reforms.length ) {
//	console.log( 'Link clicked' )
				await this.DrawReforms()
				return
			}

			if	( app.model.nodes.length ) {
				const
				_ = app.model.nodes.map( _ => [ _, Math.min( ...EdgeDist( TLBR( _[ 1 ] ), xy ) ) ] ).filter( _ => _[ 1 ] > -4 )
				_.length && RegistReform(
					_.slice( 1 ).reduce(
						( $, _ ) => $[ 1 ] < _[ 1 ] ? $ : _
					,	_[ 0 ]
					)[ 0 ]
				)
			}
			if	( !app.reforms.length ) {
//console.log( 'No target' )
				await this.DrawReforms()
				return
			}

//console.log( 'Node clicked' )
			const
			$ = app.reforms[ 0 ]
			SHAPE_EDITOR.$ = $[ 1 ]
			PAINT_EDITOR.$ = $[ 2 ]

			const
			tlbr = TLBR( $[ 1 ] )

			app.model.nodes.forEach(
				_ => ContainsTLBR( tlbr, TLBR( _[ 1 ] ) ) && RegistReform( _ )
			)

//	ROLL UP
			app.model.nodes.forEach(
				$ => app.reforms.find( _ => _[ 0 ] === $[ 0 ] ) && (
					app.model.nodes = app.model.nodes.filter( _ => _ !== $ )
				,	app.model.nodes.push( $ )
				)
			)

			await this.DrawReforms()
		}

		this.reformer.onmousemove = async ev => {

			UpdateHoverLabel( ev )

			if	( mouse[ 0 ] === null ) return
			//	mouseleave may be missed on fast movement — reset if button already released
			if	( !ev.buttons ) {
				mouse[ 0 ] = mouse[ 1 ] = null
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
				let		edgeMode = false

				const	tlbr = BBox( app.reforms.map( _ => FindNode( _[ 0 ] ) ) )
				const	edgeDist = EdgeDist( tlbr, mouse[ 0 ] )
				const	[ t, l, b, r ] = tlbr
				const	T = edgeDist[ 0 ] < 0 ? ( edgeMode = true, mouse[ 1 ][ 1 ] ) : t
				const	L = edgeDist[ 1 ] < 0 ? ( edgeMode = true, mouse[ 1 ][ 0 ] ) : l
				const	B = edgeDist[ 2 ] < 0 ? ( edgeMode = true, mouse[ 1 ][ 1 ] ) : b
				const	R = edgeDist[ 3 ] < 0 ? ( edgeMode = true, mouse[ 1 ][ 0 ] ) : r

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
console.log( 'onmouseup' )
			const
			[ mouseD, mouseU ] = mouse
			mouse[ 0 ] = mouse[ 1 ] = null
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
					this.Draw()
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
					this.Draw()
				}
				return
			}

			if	( app.reforms.length ) {
				await Reform()
				this.Draw()
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
}

customElements.define( 'main-editor', MainEditor )

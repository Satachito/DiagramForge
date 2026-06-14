export const
XYWH			= ( { cX, cY, rH, rV } ) => [ cX - rH, cY - rV, rH + rH, rV + rV ]

export const
T				= ( { cX, cY, rH, rV } ) => rV > 0 ? cY - rV : cY + rV

export const
B				= ( { cX, cY, rH, rV } ) => rV > 0 ? cY + rV : cY - rV

export const
L				= ( { cX, cY, rH, rV } ) => rH > 0 ? cX - rH : cX + rH

export const
R				= ( { cX, cY, rH, rV } ) => rH > 0 ? cX + rH : cX - rH

export const
TLBR			= ( { cX, cY, rH, rV } ) => 0 < rH
?	0 < rV
	?	[ cY - rV, cX - rH, cY + rV, cX + rH ]
	:	[ cY + rV, cX - rH, cY - rV, cX + rH ]
:	0 < rV
	?	[ cY - rV, cX + rH, cY + rV, cX - rH ]
	:	[ cY + rV, cX + rH, cY - rV, cX - rH ]

export const
XYWH_TLBR		= ( [ T, L, B, R ] ) => [ L, T, R - L, B - T ]

export const
TLBR_XYXY		= ( [ [ x, y ], [ X, Y ] ] ) => [
	y < Y ? y : Y
,	x < X ? x : X
,	y < Y ? Y : y
,	x < X ? X : x
]

export const
Union			= ( [ T, L, B, R ], [ t, l, b, r ] ) => [
	T < t ? T : t
,	L < l ? L : l
,	b < B ? B : b
,	r < R ? R : r
]

//	signed distance from a point to each edge of a tlbr ( + inside, - outside )
export const
EdgeDist		= ( [ T, L, B, R ], [ x, y ] ) => [
	y - T
,	x - L
,	B - y
,	R - x
]

export const
ContainsTLBR	= ( [ T, L, B, R ], [ t, l, b, r ] ) => T <= t && b <= B && L <= l && r <= R

export const
BBox		= _ => _.slice( 1 ).reduce(
	( $, node ) => Union( $, TLBR( node[ 1 ] ) )
,	TLBR( _[ 0 ][ 1 ] )
)

export const
ContentBounds	= ( nodes, pad = 32, canvasSize ) => {
	const
	[ cw, ch ] = canvasSize()
	if	( !nodes.length ) return { x: 0, y: 0, width: cw, height: ch }
	const
	[ T, L, B, R ] = BBox( nodes )
	const
	x = Math.max( 0, L - pad )
	,	y = Math.max( 0, T - pad )
	,	X = Math.min( cw, R + pad )
	,	Y = Math.min( ch, B + pad )
	return { x, y, width: X - x, height: Y - y }
}

export const
RectPath2D		= S => {
	const	$ = new Path2D
	$.roundRect( ...XYWH( S ), S.radii ?? 0 )
	return	$
}

export const
EllipsePath2D	= ( { cX, cY, rH, rV } ) => {
	const	$ = new Path2D
	$.ellipse( cX, cY, rH, rV, 0, 0, 2 * Math.PI )
	return	$
}

export const
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
				const	scale = sH < sV ? sH : sV
				return	[ S.cX + dX * scale, S.cY + dY * scale ]
			}
		}
	}
	return [
		$( sF, aF, sT, aT )
	,	$( sT, aT, sF, aF )
	]
}

const
linkMetrics		= ( shapeF, { headF, headT, anchorF, anchorT }, shapeT ) => {
	const	[ [ pFX, pFY ], [ pTX, pTY ] ] = LinkCoordinates( shapeF, anchorF, shapeT, anchorT )
	const
	dX = pTX - pFX
	,	dY = pTY - pFY
	const
	len = Math.hypot( dX, dY )
	if	( len < 1 ) return null

	const
	headLen = Math.min( 14, len * 0.35 )
	,	headHalf = Math.max( 5, headLen * 0.5 )
	,	shaftHalf = Math.max( 2, headHalf * 0.45 )
	,	fNeckX = headF ? headLen : 0
	,	tNeckX = len - ( headT ? headLen : 0 )
	const
	toW = ( lx, ly ) => [
		pFX + lx * ( dX / len ) - ly * ( dY / len )
	,	pFY + lx * ( dY / len ) + ly * ( dX / len )
	]
	const
	heads = []
	if	( headF )	heads.push( [ toW( 0, 0 ), toW( fNeckX, headHalf ), toW( fNeckX, -headHalf ) ] )
	if	( headT )	heads.push( [ toW( len, 0 ), toW( tNeckX, headHalf ), toW( tNeckX, -headHalf ) ] )
	return {
		shaftHalf
	,	shaft	: [ toW( fNeckX, 0 ), toW( tNeckX, 0 ) ]
	,	heads
	}
}

export const
LinkParts		= linkMetrics

export const
LinkPoints		= ( shapeF, ends, shapeT ) => {
	const
	m = linkMetrics( shapeF, ends, shapeT )
	if	( !m ) return []
	const
	{ headF, headT } = ends
	const	[ [ pFX, pFY ], [ pTX, pTY ] ] = LinkCoordinates( shapeF, ends.anchorF, shapeT, ends.anchorT )
	const
	dX = pTX - pFX
	,	dY = pTY - pFY
	const
	len = Math.hypot( dX, dY )
	const
	headLen = Math.min( 14, len * 0.35 )
	,	headHalf = Math.max( 5, headLen * 0.5 )
	,	shaftHalf = m.shaftHalf
	,	fNeckX = headF ? headLen : 0
	,	tNeckX = len - ( headT ? headLen : 0 )
	const
	toW = ( lx, ly ) => [
		pFX + lx * ( dX / len ) - ly * ( dY / len )
	,	pFY + lx * ( dY / len ) + ly * ( dX / len )
	]
	const
	points = []
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
	return	points.map( ( [ lx, ly ] ) => toW( lx, ly ) )
}

export const
LinkPath2D		= ( shapeF, ends, shapeT ) => {
	const
	points = LinkPoints( shapeF, ends, shapeT )
	const	$ = new Path2D
	if	( !points.length ) return $
	$.moveTo( ...points[ 0 ] )
	for	( let i = 1; i < points.length; i++ ) $.lineTo( ...points[ i ] )
	$.closePath()
	return	$
}

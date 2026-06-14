import {
	XYWH
,	T
,	B
,	L
,	R
,	TLBR
,	XYWH_TLBR
,	TLBR_XYXY
,	EdgeDist
,	ContainsTLBR
,	Union
} from './geo2D.js'

import { FindReform } from './Application.js'

export const
BBox			= _ => Union( _.map( _ => TLBR( _[ 1 ] ) ) )

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

//	Hit-testing for select mode: classify a point against the nodes and the
//	current selection, and pick the node a click should act on. Reads the global
//	`app` (model + reforms); pure otherwise.

//	px tolerance for grabbing a selection edge (resize handles) / click-selecting a node
export const
GRAB			= 8

const
MinEdge			= ( tlbr, xy ) => Math.min( ...EdgeDist( tlbr, xy ) )

const
PointContains	= ( tlbr, xy ) => MinEdge( tlbr, xy ) >= 0

export const
NodeInterior	= ( tlbr, xy ) => MinEdge( tlbr, xy ) > GRAB

const
SelectionGrab	= ( tlbr, xy ) => {
	const
	m = MinEdge( tlbr, xy )
	return	m > -GRAB && m <= GRAB
}

//	the node with the smallest edge distance (innermost) matching pred
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

export const
SelectedMemberAt	= xy => ClosestNodeWhere(
	xy
,	( node, tlbr, p ) => FindReform( node[ 0 ] ) && PointContains( tlbr, p )
)

export const
UnselectedAt		= xy => ClosestNodeWhere(
	xy
,	( node, tlbr, p ) => !FindReform( node[ 0 ] ) && PointContains( tlbr, p )
)

export const
SelectionInteriorAt	= xy => {
	if	( !app.reforms.length ) return false
	const
	sel = BBox( app.reforms )
	return	MinEdge( sel, xy ) > GRAB
	&&	!UnselectedAt( xy )
}

export const
SelectionGrabAt		= xy => app.reforms.length && SelectionGrab( BBox( app.reforms ), xy )

export const
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

export const
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

//	topmost node whose body contains the point ( used for node/link creation )
export const
Node_XY		= xy => ClosestNodeWhere(
	xy
,	( _, tlbr, p ) => PointContains( tlbr, p )
)

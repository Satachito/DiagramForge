//	Hit-testing for select mode: classify a point against the nodes and the
//	current selection, and pick the node a click should act on. Reads the global
//	`app` (model + reforms); pure otherwise.

import {
	XYWH
,	T
,	B
,	L
,	R
,	TLBR
,	XYWH_TLBR
,	TLBR_XYXY
,	Union
,	EdgeDist
,	ContainsTLBR
} from './geo2D.js'

import {
	BBox
}	from './geoDF.js'

import { FindReform } from './Application.js'

//	px tolerance for grabbing a selection edge (resize handles) / click-selecting a node
export const
GRAB			= 8

const
MinEdge			= ( tlbr, xy ) => Math.min( ...EdgeDist( tlbr, xy ) )

const
PointContains	= ( tlbr, xy ) => MinEdge( tlbr, xy ) >= 0

const
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

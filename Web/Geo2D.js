export const
XY_EV			= ev => [ ev.offsetX, ev.offsetY ]

export const
AddXY			= ( [ X, Y ], [ x, y ] )	=> [ X + x, Y + y ]
export const
DivXY			= ( [ X, Y ], _ )			=> [ X / _, Y / _ ]
export const
DeltaXY			= ( [ X, Y ], [ x, y ] )	=> [ x - X, y - Y ]

export const
XYWH_TLBR		= ( [ T, L, B, R ] ) => [ L, T, R - L, B - T ]

export const
TLBR_XYXY		= ( [ [ x, y ], [ X, Y ] ] ) => [
	y < Y ? y : Y
,	x < X ? x : X
,	y < Y ? Y : y
,	x < X ? X : x
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
ContainsXY		= ( [ T, L, B, R ], [ x, y ] ) => T <= y && y <= B && L <= x && x <= R

export const
ContainsTLBR	= ( [ T, L, B, R ], [ t, l, b, r ] ) => T <= t && b <= B && L <= l && r <= R

export const
AreaTLBR		= ( [ T, L, B, R ], _ ) => ( B - T ) * ( R - L )

export const
Outset			= ( [ T, L, B, R ], _ ) => [ T - _, L - _, B + _, R + _ ]

export const
Union			= _ => _.slice( 1 ).reduce(
	( [ T, L, B, R ], [ t, l, b, r ] ) => [
		T < t ? T : t
	,	L < l ? L : l
	,	b < B ? B : b
	,	r < R ? R : r
	]
,	_[ 0 ]
)

export const
XYWH_XYXY		= ( [ [ x, y ], [ X, Y ] ] ) => [ x, y, X - x, Y - y ]


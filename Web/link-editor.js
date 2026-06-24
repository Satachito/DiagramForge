import {
	AE
,	LabeledSelect
}	from './DomUtils.js'

const
HEAD_STYLES		= [ '', 'triangle', 'open', 'hollow', 'diamond', 'diamondHollow', 'circle', 'circleHollow' ]

const
CORNER_STYLES	= [ '', 'sharp', 'bezier', 'arc' ]

const
RefreshSelect	= _ => {
	const
	$ = _.value
	_.replaceChildren()
	app.model.nodes.forEach( node => AE( _, 'option' ).innerHTML = node[ 0 ] )
	_.value = $
}

const
ADiv			= _ => AE( _, 'div' )

export default class
LinkEditor extends HTMLElement {

	constructor() {
		super()

		const
		$	= [ '', 'T', 'L', 'B', 'R', 'TL', 'TR', 'BL', 'BR' ]

		this.F			= LabeledSelect		( this, 'from' )
		this.F.onclick	= ev => RefreshSelect( ev.target )
		this.HEAD_F		= LabeledSelect		( this, '-head'		, ...HEAD_STYLES )
		this.ANCHOR_F	= LabeledSelect		( this, '-anchor'	, ...$ )

		this.T			= LabeledSelect		( this, 'to' )
		this.T.onclick	= ev => RefreshSelect( ev.target )
		this.HEAD_T		= LabeledSelect		( this, '-head'		, ...HEAD_STYLES )
		this.ANCHOR_T	= LabeledSelect		( this, '-anchor'	, ...$ )

		this.CORNER		= LabeledSelect		( this, 'corner'	, ...CORNER_STYLES )
	}

	Sync() {
		RefreshSelect( this.F )
		RefreshSelect( this.T )
	}

	set $( [ [ F, T ], { headF, headT, anchorF, anchorT, corner } ] ) {
		this.Sync()
		this.F.value		= F
		this.T.value		= T
		this.HEAD_F.value	= headF === true ? 'triangle' : ( headF || '' )
		this.HEAD_T.value	= headT === true ? 'triangle' : ( headT || '' )
		this.ANCHOR_F.value	= anchorF ?? ''
		this.ANCHOR_T.value	= anchorT ?? ''
		this.CORNER.value	= corner ?? ''
	}

	get $() {
		const
		A = {}
		this.HEAD_F.value && ( A[ 'headF'		] = this.HEAD_F.value )
		this.HEAD_T.value && ( A[ 'headT'		] = this.HEAD_T.value )
		this.ANCHOR_F.value && ( A[ "anchorF"	] = this.ANCHOR_F.value )
		this.ANCHOR_T.value && ( A[ "anchorT"	] = this.ANCHOR_T.value )
		this.CORNER.value && ( A[ "corner"		] = this.CORNER.value )
		return [ [ this.F.value, this.T.value ], A ]
	}
}

customElements.define( 'link-editor', LinkEditor )

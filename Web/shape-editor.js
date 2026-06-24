import {
	LabeledInput
,	LabeledSelect
,	LabeledTextArea
} from './DomUtils.js'

export default class
ShapeEditor extends HTMLElement {

	constructor() {
		super()

		this.CX				= LabeledInput		( this, 'cX'	, '100' )
		this.CY				= LabeledInput		( this, 'cY'	, '100' )
		this.RH				= LabeledInput		( this, 'rH'	, '100' )
		this.RV				= LabeledInput		( this, 'rV'	, '100' )
		this.RADII			= LabeledInput		( this, 'radii'	)

		this.TYPE			= LabeledSelect		( this, 'type'	, 'rect', 'ellipse', 'rhombus', 'PNG', 'SVG' )

		this.HTML			= LabeledTextArea	( this, 'HTML:'	)
		this.STYLE			= LabeledTextArea	( this, 'STYLE:')
		this.STYLE.value	= ';display    : grid\n;place-items: center'
	}

	get	$() {
		const
		$ = {}

		this.CX		.value	&& ( $[ 'cX'	] = Number( this.CX		.value ) )
		this.CY		.value	&& ( $[ 'cY'	] = Number( this.CY		.value ) )
		this.RH		.value	&& ( $[ 'rH'	] = Number( this.RH		.value ) )
		this.RV		.value	&& ( $[ 'rV'	] = Number( this.RV		.value ) )
		this.RADII	.value	&& ( $[ 'radii'	] = Number( this.RADII	.value ) )

		this.TYPE	.value	&& ( $[ 'type'	] = this.TYPE	.value )
		this.HTML	.value	&& ( $[ 'html'	] = this.HTML	.value )
		this.STYLE	.value	&& ( $[ 'style'	] = this.STYLE	.value )

		return $
	}

	set	$( _ ) {

		this.CX		.value	= _.cX
		this.CY		.value	= _.cY
		this.RH		.value	= _.rH
		this.RV		.value	= _.rV
		this.RADII	.value	= _.radii	?? ''

		this.TYPE	.value	= _.type
		this.HTML	.value	= _.html	?? ''
		this.STYLE	.value	= _.style	?? ''
	}
}

customElements.define( 'shape-editor', ShapeEditor )


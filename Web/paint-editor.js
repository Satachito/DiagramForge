import { LabeledInput, LabeledSelect } from './DomUtils.js'

export default class
PaintEditor extends HTMLElement {

	constructor() {
		super()

		this.FILL				= LabeledInput	( this, 'fill'			)
		this.STROKE				= LabeledInput	( this, 'stroke'		, 'gray'	)
		this.LINE_WIDTH			= LabeledInput	( this, 'width'			, '2'		)
		this.LINE_CAP			= LabeledSelect	( this, 'cap'			, '', 'butt'	, 'round', 'square'	)
		this.LINE_JOIN			= LabeledSelect	( this, 'join'			, '', 'bevel'	, 'round', 'miter'	)
		this.MITER_LIMIT		= LabeledInput	( this, 'miterLimit'	)
		this.LINE_DASH_OFFSET	= LabeledInput	( this, 'dashOffset'	)
		this.LINE_DASH			= LabeledInput	( this, 'dash'			)
	}

	set $( _ ) {
		this.FILL				.value = _.fill				?? ''
		this.STROKE				.value = _.stroke			?? ''
		this.LINE_WIDTH			.value = _.lineWidth		?? ''
		this.LINE_CAP			.value = _.lineCap			?? ''
		this.LINE_JOIN			.value = _.lineJoin			?? ''
		this.MITER_LIMIT		.value = _.miterLimit		?? ''
		this.LINE_DASH_OFFSET	.value = _.lineDashOffset	?? ''
		this.LINE_DASH			.value = _.lineDash ? JSON.stringify( _.lineDash ) : ''

	}

	get $() {
		const
		$ = {}
		this.FILL				.value && ( $[ 'fill'			] = this.FILL				.value )
		this.STROKE				.value && ( $[ 'stroke'			] = this.STROKE				.value )
		this.LINE_WIDTH			.value && ( $[ 'lineWidth'		] = this.LINE_WIDTH			.value )
		this.LINE_CAP			.value && ( $[ 'lineCap'		] = this.LINE_CAP			.value )
		this.LINE_JOIN			.value && ( $[ 'lineJoin'		] = this.LINE_JOIN			.value )
		this.MITER_LIMIT		.value && ( $[ 'miterLimit'		] = this.MITER_LIMIT		.value )
		this.LINE_DASH_OFFSET	.value && ( $[ 'lineDashOffset'	] = this.LINE_DASH_OFFSET	.value )
		this.LINE_DASH			.value && ( $[ 'lineDash'		] = JSON.parse( this.LINE_DASH.value ) )
		return $
	}
}

customElements.define( 'paint-editor', PaintEditor )


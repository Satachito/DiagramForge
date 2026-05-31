import {
	AC
,	AE
,	LabeledSelect
,	LabeledInput
,	LabeledCheckbox
}	from './DomUtils.js'

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
		this.HEAD_F		= LabeledCheckbox	( this, '-head'		, true )
		this.ANCHOR_F	= LabeledSelect		( this, '-anchor'	, ...$ )

		this.T			= LabeledSelect		( this, 'to' )
		this.T.onclick	= ev => RefreshSelect( ev.target )
		this.HEAD_T		= LabeledCheckbox	( this, '-head'		, true )
		this.ANCHOR_T	= LabeledSelect		( this, '-anchor'	, ...$ )
	}

	Sync() {
		RefreshSelect( this.F )
		RefreshSelect( this.T )
	}

	set $( [ F, { headF, headT, anchorF, anchorT }, T ] ) {
		this.Sync()
		this.F.value		= F
		this.HEAD_F.checked	= headF
		this.HEAD_T.checked	= headT
		this.ANCHOR_F.value	= anchorF ?? ''
		this.ANCHOR_T.value	= anchorT ?? ''
		this.T.value		= T
	}

	get $() {
		const
		A = {
			headF	: this.HEAD_F.checked
		,	headT	: this.HEAD_T.checked
		}
		this.ANCHOR_F.value && ( A[ "anchorF" ] = this.ANCHOR_F.value )
		this.ANCHOR_T.value && ( A[ "anchorT" ] = this.ANCHOR_T.value )
		return [
			this.F.value
		,	A
		,	this.T.value
		]
	}
}

customElements.define( 'link-editor', LinkEditor )

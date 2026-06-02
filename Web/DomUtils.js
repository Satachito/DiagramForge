export const
RoleE 		= ( $, _ ) => $.querySelector( `[data-role=${_}]` )

export const
AC			= ( $, _ ) => $.appendChild( _ )

export const
E			= _ => document.createElement( _ )

export const
AE			= ( $, _ ) => AC( $, E( _ ) )

export const
Input		= _ => {
	const	$ = E( 'input' )
	_ && ( $.value = _ )
	return $
}

export const
Select		= ( ..._ ) => {
	const $ = E( 'select' )
	for ( const option of _ ) AE( $, 'option' ).innerHTML = option
	return $
}

export const
Checkbox	= _ => {
	const	$ = E( 'input' )
	$.type = 'checkbox'
	$.checked = _
	return $
}

export const
Labeled		= ( parent, label, _ ) => {
	const
	$ = AE( parent, 'div' )

	$.style.display			= 'flex'
	$.style.alignItems		= 'center'
	$.style.justifyContent	= 'space-between'
	$.innerHTML				= label

	return AC( $, _ )
}

export const
LabeledInput	= ( parent, label, _ = ''		) => Labeled( parent, label, Input( _ ) )

export const
LabeledSelect	= ( parent, label, ..._			) => Labeled( parent, label, Select( ..._ ) )

export const
LabeledCheckbox	= ( parent, label, _ = false	) => Labeled( parent, label, Checkbox( _ ) )

export const
LabeledTextArea	= ( parent, label ) => {
	const $ = AE( parent, 'div' )
	AE( $, 'div' ).textContent	= label
	return AE( $, 'textarea' )
}

export const
EscapeXML		= _ => String( _ )
.	replace( /&/g, '&amp;' )
.	replace( /</g, '&lt;' )
.	replace( />/g, '&gt;' )


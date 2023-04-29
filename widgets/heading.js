exports('heading', function (text) {
	const headingStyle = style.heading

	painter.setText(text)
	painter.setTextOpts(headingStyle.text.font, headingStyle.text.scale)

	const w = context.getWidgetWidth() || painter.calculateTextWidth()
	const h = headingStyle.height

	context.beginDraw(w, h)

	painter.setColor(style.color.primary)
	painter.drawText(headingStyle.text.offset)

	context.endDraw()
})
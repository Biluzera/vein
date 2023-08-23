import { Color, Image, TextEntryComponents, Vector2 } from '../common/types';
import { getIsDebugEnabled } from '../index';
import { Context } from './context';
import { Style, StylePropertyValues } from './style';
import { addTextComponents } from './utils';

class LayoutState {
	isValid = false;
	isFirstItem = false;
	size = new Vector2();
}

class RowState {
	isInRowMode = false;
	isFirstItem = false;
	size = new Vector2();
}

class DragState {
	isInProcess = false;
	origin = new Vector2();
}

class Geometry {
	pos = new Vector2();
	size = new Vector2();
}

export class Painter {
	private style = new Style();
	private pos = new Vector2();
	private color: Color = [0, 0, 0, 255];
	private layoutState = new LayoutState();
	private dragState = new DragState();
	private rowState = new RowState();
	private itemGeometry = new Geometry();
	private windowGeometry = new Geometry();
	private windowSpacing = new Vector2();

	constructor(private context: Context) {}

	beginWindow(x: number, y: number) {
		this.windowGeometry.pos.set(x, y);

		this.setPos(
			this.windowGeometry.pos.x - this.windowGeometry.size.x / 2,
			this.windowGeometry.pos.y - this.windowGeometry.size.y / 2
		);

		if (!this.isLayoutValid()) return;

		if (!this.context.isWindowNoDrag()) this.beginDrag();

		if (!this.context.isWindowNoBackground())
			this.drawItemBackground(
				this.style.getProperties(this.context.getWindowId() ?? 'window'),
				this.windowGeometry.size.x,
				this.windowGeometry.size.y
			);

		const windowSpacing = this.context.getWindowSpacing();
		this.windowSpacing.x = windowSpacing !== undefined ? windowSpacing.x : this.style.window.spacing.x;
		this.windowSpacing.y = windowSpacing !== undefined ? windowSpacing.y : this.style.window.spacing.y;
	}

	endWindow(): Vector2 {
		if (!this.context.isWindowNoDrag()) this.endDrag();

		this.layoutState.isValid = !this.layoutState.isFirstItem;
		this.layoutState.isFirstItem = true;

		this.windowGeometry.size.set(
			this.layoutState.isValid ? this.layoutState.size.x + this.style.window.margins.x * 2 : 0,
			this.layoutState.isValid ? this.layoutState.size.y + this.style.window.margins.y * 2 : 0
		);

		this.layoutState.size.set(0, 0);

		return this.windowGeometry.pos;
	}

	private isLayoutValid(): boolean {
		return this.layoutState.isValid && !this.context.isWindowSkipNextDrawing();
	}

	private beginDrag() {
		if (this.dragState.isInProcess) return;

		const input = this.context.getInput();

		if (
			input.isRectHovered(this.pos.x, this.pos.y, this.windowGeometry.size.x, this.style.window.margins.y) &&
			input.getIsLmbPressed()
		) {
			const mousePos = input.getMousePos();
			this.dragState.origin.set(mousePos.x, mousePos.y);
			this.dragState.isInProcess = true;
		}
	}

	private endDrag() {
		if (!this.dragState.isInProcess) return;

		const input = this.context.getInput();

		if (input.getIsLmbDown()) {
			const mousePos = input.getMousePos();

			this.windowGeometry.pos.set(
				this.windowGeometry.pos.x + mousePos.x - this.dragState.origin.x,
				this.windowGeometry.pos.y + mousePos.y - this.dragState.origin.y
			);

			this.dragState.origin.set(mousePos.x, mousePos.y);
		} else this.dragState.isInProcess = false;
	}

	getX(): number {
		return this.pos.x;
	}

	getY(): number {
		return this.pos.y;
	}

	beginRow() {
		if (!this.rowState.isInRowMode) {
			this.rowState.isInRowMode = true;
			this.rowState.isFirstItem = true;
		}
	}

	endRow() {
		if (!this.rowState.isInRowMode) return;

		this.layoutState.size.set(
			Math.max(this.layoutState.size.x, this.rowState.size.x),
			this.layoutState.size.y + this.rowState.size.y
		);

		this.setPos(
			this.windowGeometry.pos.x - this.windowGeometry.size.x / 2 + this.style.window.margins.x,
			this.pos.y + this.rowState.size.y
		);

		this.rowState.isInRowMode = false;
		this.rowState.isFirstItem = true;

		this.rowState.size.set(0, 0);
	}

	isRowMode(): boolean {
		return this.rowState.isInRowMode;
	}

	beginDraw(w: number, h: number) {
		if (this.layoutState.isFirstItem) this.move(this.style.window.margins.x, this.style.window.margins.y);
		else {
			let ho = 0;
			if (this.rowState.isInRowMode && !this.rowState.isFirstItem) {
				ho = this.windowSpacing.x;
				this.rowState.size.x += ho;
			}

			let vo = 0;
			if (!this.rowState.isInRowMode || this.rowState.isFirstItem) vo = this.windowSpacing.y;

			this.layoutState.size.x += ho;
			this.layoutState.size.y += vo;

			this.move(ho, vo);
		}

		this.itemGeometry.pos.set(this.pos.x, this.pos.y);
		this.itemGeometry.size.set(w, h);
	}

	endDraw() {
		const w = this.itemGeometry.size.x;
		const h = this.itemGeometry.size.y;

		this.drawDebug(w, h);

		if (this.rowState.isInRowMode) {
			this.rowState.size.set(this.rowState.size.x + w, Math.max(this.rowState.size.y, h));
			this.setPos(this.itemGeometry.pos.x + w, this.itemGeometry.pos.y);
			this.rowState.isFirstItem = false;
		} else {
			this.layoutState.size.set(Math.max(w, this.layoutState.size.x), this.layoutState.size.y + h);
			this.setPos(this.itemGeometry.pos.x, this.itemGeometry.pos.y + h);
		}

		this.layoutState.isFirstItem = false;
	}

	getItemX(): number {
		return this.itemGeometry.pos.x;
	}

	getItemY(): number {
		return this.itemGeometry.pos.y;
	}

	getItemWidth(): number {
		return this.itemGeometry.size.x;
	}

	getItemHeight(): number {
		return this.itemGeometry.size.y;
	}

	getWindowSpacing(): Vector2 {
		return this.windowSpacing;
	}

	setPos(x: number, y: number) {
		this.pos.x = x;
		this.pos.y = y;
	}

	move(x: number, y: number) {
		this.pos.x += x;
		this.pos.y += y;
	}

	getStyle(): Style {
		return this.style;
	}

	setColor(color: Color) {
		this.color = color;
	}

	drawItemBackground(properties: StylePropertyValues, w: number, h: number) {
		const backgroundImage = properties.tryGet<Image>('background-image');
		if (backgroundImage !== undefined) {
			const backgroundColor = properties.tryGet<Color>('background-color');
			this.setColor(backgroundColor ?? Style.SPRITE_COLOR);
			this.drawSprite(backgroundImage[0], backgroundImage[1], w, h);
		} else {
			this.setColor(properties.get<Color>('background-color'));
			this.drawRect(w, h);
		}
	}

	drawRect(w: number, h: number) {
		if (this.isLayoutValid())
			DrawRect(
				this.pos.x + w / 2,
				this.pos.y + h / 2,
				w,
				h,
				this.color[0],
				this.color[1],
				this.color[2],
				this.color[3]
			);
	}

	drawSprite(dict: string, name: string, w: number, h: number) {
		if (this.isLayoutValid())
			DrawSprite(
				dict,
				name,
				this.pos.x + w / 2,
				this.pos.y + h / 2,
				w,
				h,
				0,
				this.color[0],
				this.color[1],
				this.color[2],
				this.color[3]
			);
	}

	getTextWidth(): number {
		const textEntry: string | undefined = this.context.getTextEntry();
		if (!textEntry) return 0;

		BeginTextCommandGetWidth(textEntry);

		const textComponents: TextEntryComponents | undefined = this.context.getTextComponents();
		if (textComponents) addTextComponents(textComponents);

		return EndTextCommandGetWidth(true);
	}

	getTextLineCount(): number {
		const textEntry: string | undefined = this.context.getTextEntry();
		if (!textEntry) return 0;

		BeginTextCommandLineCount(textEntry);

		const textComponents: TextEntryComponents | undefined = this.context.getTextComponents();
		if (textComponents) addTextComponents(textComponents);

		return EndTextCommandLineCount(this.pos.x, this.pos.y);
	}

	setText(font: number, scale: number, text?: string, w?: number) {
		SetTextFont(font);
		SetTextScale(1, scale);
		if (text !== undefined) this.context.setNextTextEntry('STRING', text);
		if (w !== undefined) SetTextWrap(this.pos.x, this.pos.x + w);
	}

	drawText() {
		if (!this.isLayoutValid()) return;

		const textEntry: string | undefined = this.context.getTextEntry();
		if (!textEntry) return;

		SetTextColour(this.color[0], this.color[1], this.color[2], this.color[3]);

		BeginTextCommandDisplayText(textEntry);

		const textComponents: TextEntryComponents | undefined = this.context.getTextComponents();
		if (textComponents) addTextComponents(textComponents);

		EndTextCommandDisplayText(this.pos.x, this.pos.y);
	}

	drawDebug(w: number, h = this.style.item.height) {
		if (!this.isLayoutValid() || !getIsDebugEnabled()) return;

		this.setPos(this.itemGeometry.pos.x, this.itemGeometry.pos.y);
		this.setColor(this.style.getProperty<Color>('window', 'color'));
		this.drawRect(w, h);
	}
}

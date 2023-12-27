import { Color, Rect, Vector2 } from './types';
import { Input, InputFlags, InputControl } from './input';
import { Layout } from './layout';
import { Painter } from './painter';
import { Style, StylePropertyValue } from './style';
import { drawItemBackground } from './utils';

class ItemState {
	styleId: string | undefined = undefined;
	width: number | undefined = undefined;
	disabled = false;
}

enum FrameFlags {
	None,
	DisableBackground = 1 << 1,
	DisableBorder = 1 << 2,
	DisableMove = 1 << 3
}

class FrameState {
	inputFlags = InputFlags.None;
	flags = FrameFlags.None;
	position: Vector2 | undefined = undefined;
	scale: number | undefined = undefined;
	size: [number | undefined, number | undefined] | undefined = undefined;
	spacing: [number | undefined, number | undefined] | undefined = undefined;
	styleId: string | undefined = undefined;
}

class FrameMemory {
	rect = new Rect(new Vector2(0.33, 0.33));
	movePosition: Vector2 | null = null;
}

export enum MouseCursor {
	None = 0,
	Normal = 1,
	TransparentNormal = 2,
	PreGrab = 3,
	Grab = 4,
	MiddleFinger = 5,
	LeftArrow = 6,
	RightArrow = 7,
	UpArrow = 8,
	DownArrow = 9,
	HorizontalExpand = 10,
	Add = 11,
	Remove = 12
}

export class Frame {
	private static readonly DEFAULT_ID = 'DEFAULT';

	private static frameMemory = new Map<string, FrameMemory>();
	private static style = new Style();
	private static nextState = new FrameState();
	private static isDebugEnabled_ = false;

	private memory: FrameMemory;
	private input = new Input(Frame.nextState.inputFlags);
	private painter: Painter;
	private nextItemState = new ItemState();
	private mouseCursor = MouseCursor.Normal;
	private itemWidthStack: number[] = [];
	private itemStyleIdStack: string[] = [];

	private layout: Layout;

	static isDebugEnabled(): boolean {
		return Frame.isDebugEnabled_;
	}

	static setDebugEnabled(enabled: boolean) {
		Frame.isDebugEnabled_ = enabled;
	}

	static setNextFramePosition(x: number, y: number) {
		Frame.nextState.position = new Vector2(x, y);
	}

	static setNextFrameScale(scale: number) {
		Frame.nextState.scale = scale;
	}

	static setNextFrameSize(w: number | undefined, h: number | undefined) {
		Frame.nextState.size = [w, h];
	}

	static setNextFrameSpacing(x: number | undefined, y: number | undefined) {
		Frame.nextState.spacing = [x, y];
	}

	static setNextFrameStyleId(id: string) {
		Frame.nextState.styleId = id;
	}

	static setNextFrameDisableBackground() {
		Frame.nextState.flags |= FrameFlags.DisableBackground;
	}

	static setNextFrameDisableBorder() {
		Frame.nextState.flags |= FrameFlags.DisableBorder;
	}

	static setNextFrameDisableInput() {
		Frame.nextState.inputFlags |= InputFlags.DisableInput;
	}

	static setNextFrameDisableMove() {
		Frame.nextState.flags |= FrameFlags.DisableMove;
	}

	static getStyle(): Style {
		return Frame.style;
	}

	static getStyleId(): string | undefined {
		return Frame.nextState.styleId;
	}

	static getScale(): number {
		return Frame.nextState.scale ?? 1.0;
	}

	static getSpacing(): Vector2 {
		if (Frame.nextState.spacing === undefined) return Frame.style.frame.itemSpacing;
		return new Vector2(
			Frame.nextState.spacing[0] ?? Frame.style.frame.itemSpacing.x,
			Frame.nextState.spacing[1] ?? Frame.style.frame.itemSpacing.y
		);
	}

	static isBackgroundDisabled(): boolean {
		return !!(Frame.nextState.flags & FrameFlags.DisableBackground);
	}

	static isBorderDisabled(): boolean {
		return !!(Frame.nextState.flags & FrameFlags.DisableBorder);
	}

	static isInputDisabled(): boolean {
		return !!(Frame.nextState.inputFlags & InputFlags.DisableInput);
	}

	static isMoveDisabled(): boolean {
		return !!(Frame.nextState.flags & FrameFlags.DisableMove);
	}

	static getStyleProperty(selector: string, property: string): StylePropertyValue {
		return Frame.style.getProperty(selector, property);
	}

	constructor(id: string | undefined) {
		if (id === undefined) id = Frame.DEFAULT_ID;

		let memory = Frame.frameMemory.get(id);
		const isNewFrame = memory === undefined;

		if (memory === undefined) {
			memory = new FrameMemory();
			Frame.frameMemory.set(id, memory);
		}

		this.memory = memory;

		if (Frame.nextState.position !== undefined) {
			this.memory.rect.position.x = Frame.nextState.position.x;
			this.memory.rect.position.y = Frame.nextState.position.y;
		}

		this.beginMove();

		const rect = this.getRect();
		const scale = Frame.getScale();
		const spacing = Frame.getSpacing();

		this.layout = new Layout(
			rect.position.x + Frame.style.frame.padding.x * scale,
			rect.position.y + Frame.style.frame.padding.y * scale,
			new Vector2(spacing.x * scale, spacing.y * scale),
			scale
		);

		this.painter = new Painter(rect.position.x, rect.position.y, scale, `VEIN_${id}`);

		if (isNewFrame || Frame.isBackgroundDisabled()) return;

		const selector = this.buildStyleSelector('frame');
		const unscaledRect = new Rect(rect.position, new Vector2(rect.size.x / scale, rect.size.y / scale));

		drawItemBackground(this, selector, unscaledRect.size.x, unscaledRect.size.y);

		if (Frame.isBorderDisabled()) return;

		this.drawBorder(selector, unscaledRect);
		this.painter.setPosition(rect.position.x, rect.position.y);
	}

	getInput(): Input {
		return this.input;
	}

	getPainter(): Painter {
		return this.painter;
	}

	getLayout(): Layout {
		return this.layout;
	}

	getRect(): Rect {
		const rect = this.memory.rect;
		if (Frame.nextState.size === undefined) return rect;
		return new Rect(
			new Vector2(rect.position.x, rect.position.y),
			new Vector2(Frame.nextState.size[0] ?? rect.size.x, Frame.nextState.size[1] ?? rect.size.y)
		);
	}

	end() {
		this.endMove();

		if (!Frame.isInputDisabled()) {
			SetMouseCursorActiveThisFrame();
			SetMouseCursorSprite(this.mouseCursor);
		}

		this.mouseCursor = MouseCursor.Normal;

		const contentRect = this.layout.getContentRect();
		const scale = Frame.getScale();

		this.memory.rect.size = new Vector2(
			contentRect.size.x + Frame.style.frame.padding.x * scale * 2,
			contentRect.size.y + Frame.style.frame.padding.y * scale * 2
		);

		this.itemStyleIdStack = [];
		this.itemWidthStack = [];

		Frame.nextState = new FrameState();
	}

	beginItem(w: number, h: number) {
		this.layout.beginItem(w, h);

		const itemRect = this.layout.getItemRect();
		this.painter.setPosition(itemRect.position.x, itemRect.position.y);
	}

	endItem() {
		if (Frame.isDebugEnabled_) {
			const itemRect = this.layout.getItemRect();
			const scale = Frame.getScale();
			const unscaledItemRect = new Rect(
				itemRect.position,
				new Vector2(itemRect.size.x / scale, itemRect.size.y / scale)
			);

			this.painter.setPosition(unscaledItemRect.position.x, unscaledItemRect.position.y);
			this.painter.setColor(Frame.style.getPropertyAs<Color>('frame', 'color'));
			this.painter.drawRect(unscaledItemRect.size.x, unscaledItemRect.size.y);
		}

		this.layout.endItem();

		this.nextItemState = new ItemState();
	}

	setNextItemWidth(w: number) {
		this.nextItemState.width = w;
	}

	pushItemWidth(w: number) {
		this.itemWidthStack.push(w);
	}

	popItemWidth() {
		this.itemWidthStack.pop();
	}

	setNextItemDisabled() {
		this.nextItemState.disabled = true;
	}

	tryGetItemWidth(): number | undefined {
		return this.nextItemState.width ?? this.itemWidthStack[this.itemWidthStack.length - 1];
	}

	setNextItemStyleId(id: string) {
		this.nextItemState.styleId = id;
	}

	pushItemStyleId(id: string) {
		this.itemStyleIdStack.push(id);
	}

	popItemStyleId() {
		this.itemStyleIdStack.pop();
	}

	isAreaHovered(rect: Rect): boolean {
		return rect.contains(this.input.getMousePosition());
	}

	isItemDisabled(): boolean {
		return this.nextItemState.disabled;
	}

	isItemClicked(): boolean {
		return (
			!this.isItemDisabled() && this.input.isControlReleased(InputControl.MouseLeftButton) && this.isItemHovered()
		);
	}

	isItemHovered(): boolean {
		return !this.isItemDisabled() && this.isAreaHovered(this.layout.getItemRect());
	}

	isItemPressed(): boolean {
		return !this.isItemDisabled() && this.input.isControlDown(InputControl.MouseLeftButton) && this.isItemHovered();
	}

	setMouseCursor(mouseCursor: MouseCursor) {
		this.mouseCursor = mouseCursor;
	}

	buildStyleSelector(name: string, state: string | undefined = undefined): string {
		const id = this.nextItemState.styleId ?? this.itemStyleIdStack[this.itemStyleIdStack.length - 1];
		return Frame.style.buildSelector(name, id, state);
	}

	private beginMove() {
		if (Frame.isMoveDisabled() || Frame.isInputDisabled()) return;

		if (
			!this.isAreaHovered(
				new Rect(
					this.memory.rect.position,
					new Vector2(this.memory.rect.size.x, Frame.style.frame.padding.y * Frame.getScale())
				)
			)
		)
			return;

		if (!this.memory.movePosition) {
			if (this.input.isControlPressed(InputControl.MouseLeftButton)) {
				const mousePosition = this.input.getMousePosition();
				this.memory.movePosition = new Vector2(mousePosition.x, mousePosition.y);
			}
		} else if (!this.input.isControlDown(InputControl.MouseLeftButton)) {
			this.memory.movePosition = null;
		}

		if (!this.memory.movePosition) this.mouseCursor = MouseCursor.PreGrab;
	}

	private endMove() {
		if (!this.memory.movePosition) return;

		const mousePosition = this.input.getMousePosition();

		this.memory.rect.position.x += mousePosition.x - this.memory.movePosition.x;
		this.memory.rect.position.y += mousePosition.y - this.memory.movePosition.y;

		this.memory.movePosition = new Vector2(mousePosition.x, mousePosition.y);

		this.mouseCursor = MouseCursor.Grab;
	}

	private drawBorder(selector: string, unscaledRect: Rect) {
		const rect = this.getRect();
		const scale = Frame.getScale();
		const bw = Frame.style.frame.borderWidth;
		const bh = bw * GetAspectRatio(false) + 0.00049;

		this.painter.setColor(Frame.style.getPropertyAs<Color>(selector, 'border-color'));
		this.painter.setPosition(rect.position.x + bw * scale, rect.position.y + rect.size.y);
		this.painter.drawRect(unscaledRect.size.x - bw, bh); // bottom
		this.painter.setPosition(rect.position.x + rect.size.x, rect.position.y + bh * scale);
		this.painter.drawRect(bw, unscaledRect.size.y); // right
	}
}

let frame: Frame | null = null;

export function getFrameChecked(): Frame {
	if (!frame) throw new Error('Frame is null');
	return frame;
}

export function setFrame(frame_: Frame | null) {
	frame = frame_;
}

<script setup lang="ts">
import {RandomCharSet} from "@/util/randomString.ts";
import RandomNamespace from "@/util/randomNamespace.ts";
import {computed, ref, useTemplateRef} from "vue";

export type Eventish = {
	target: {
		value: any,
		id?: string,
		name?: string,
	}
}

const ns = new RandomNamespace(5, "_", RandomCharSet.xml);

type Props = { x: number, y: number, width?: number, height?: number, initialZoom?: number, id?: string, name?: string };
const props = withDefaults(defineProps<Props>(), {
	width: 200,
	height: 200,
	initialZoom: 1,
	id: undefined,
	name: undefined,
});
const emit = defineEmits(["change"]);

const gridRef = useTemplateRef("gridSvg");
const inputXRef = useTemplateRef("inputX");
const inputYRef = useTemplateRef("inputY");

// Component (client) dimensions
const dimensions = {
	dotRadius: 5,
	gridTargetSize: 20,
	gridMinPx: 10,
	gridSubdivs: 10,
	zoomStep: 10 ** 0.2,
};

// Client window size
const clientWindow = ref<[number, number]>([props.width, props.height]);
// Zoom multiplier
const zoomLevel = ref<number>(props.initialZoom);
// Pan within window size, in zoomed units
const panPosition = ref<[number, number]>([0, 0]);

const snapToGrid = ref<boolean>(false);

function grid(gridTargetSize: number, gridMinPx: number) {
	const base = gridMinPx / gridTargetSize;
	const oom = Math.floor(Math.log10(zoomLevel.value) / Math.log10(base));

	const strictGridSquareValue = base ** -oom * gridTargetSize;
	const gridSquareValue = 10 ** (Math.round(Math.log10(strictGridSquareValue / 100)) + 2);
	const gridSquareSize = Math.trunc(gridSquareValue * zoomLevel.value * 10000) / 10000;

	return {px: gridSquareSize, oom, gridSquareValue};
}

const scene = computed(() => {
	const clientZero: [number, number] = [
		clientWindow.value[0] / 2 + zoomLevel.value * panPosition.value[0],
		clientWindow.value[1] / 2 + zoomLevel.value * panPosition.value[1]
	];
	const majorGrid = grid(dimensions.gridTargetSize * dimensions.gridSubdivs, dimensions.gridMinPx * dimensions.gridSubdivs);

	return {
		clientWindow: clientWindow.value,
		clientZero,
		clientPoint: [
			clientZero[0] + props.x * zoomLevel.value,
			clientZero[1] + props.y * zoomLevel.value
		],

		majorGrid,

		zoom: zoomLevel.value,
		pan: panPosition.value,
	};
});

const styles = computed(() => ({
	"--box-size": 50,
	"--box-stroke": 2,
	"--dot-radius": dimensions.dotRadius + "px",
	"--zero-x": scene.value.clientZero[0] + "px",
	"--zero-y": scene.value.clientZero[1] + "px",
	"--client-pan-x": scene.value.pan[0] * zoomLevel.value + "px",
	"--client-pan-y": scene.value.pan[1] * zoomLevel.value + "px",
	"--target-x": scene.value.clientPoint[0] + "px",
	"--target-y": scene.value.clientPoint[1] + "px",
}));

function clientPointToPoint(x: number, y: number): [number, number] {
	const rect = gridRef.value!.getBoundingClientRect();
	return [x - rect.left, y - rect.top];

}

function clientPointToValue(x: number, y: number, snap: boolean = false): [number, number] {
	return pointToValue(...clientPointToPoint(x, y), snap);
}

function pointToValue(x: number, y: number, snap: boolean = false): [number, number] {
	const value: [number, number] = [
		(x - scene.value.clientZero[0]) / zoomLevel.value,
		(y - scene.value.clientZero[1]) / zoomLevel.value,
	];
	if (!snap) return value;
	const minorSize = scene.value.majorGrid.gridSquareValue / dimensions.gridSubdivs;
	return [
		Math.round(value[0] / minorSize) * minorSize,
		Math.round(value[1] / minorSize) * minorSize,
	];
}

function valueToPoint(x: number, y: number): [number, number] {
	return [
		scene.value.clientZero[0] + x * zoomLevel.value,
		scene.value.clientZero[1] + y * zoomLevel.value
	];
}

const lineEndPos = computed(() => {
	const start = scene.value.clientZero;

	const slope = props.y / props.x;
	const multiplier = (props.x >= 0 ? 1 : -1) / zoomLevel.value;

	if (isNaN(slope) || !isFinite(slope)) {
		return [start[0], start[1] + (props.y >= 0 ? dimensions.dotRadius : -dimensions.dotRadius)];
	}

	const offset = [
		zoomLevel.value * multiplier * (dimensions.dotRadius / Math.sqrt(slope ** 2 + 1)),
	];
	offset.push(slope * offset[0]);

	const result = valueToPoint(props.x, props.y).map((point, idx) => point - offset[idx]);
	return result;
});

const inDrag = ref<boolean>(false);
const inPan = ref<boolean>(false);
let dragAbort: AbortController;
let mouseDownTimeout: number | undefined = undefined;
let panFrom = [0, 0];

function dragEvents(move: (e: MouseEvent) => void, drop: (e: MouseEvent) => void) {
	dragAbort = new AbortController();
	window.addEventListener("mousemove", move, {signal: dragAbort.signal});
	window.addEventListener("mouseup", drop, {signal: dragAbort.signal});
}

function clearInDrag() {
	setTimeout(() => {
		inDrag.value = false;
		if (mouseDownTimeout !== undefined) clearTimeout(mouseDownTimeout);
	}, 0);
}

function panDragStart(e: MouseEvent) {
	dragEvents(panDragMove, panDragStop);
	panFrom = clientPointToPoint(e.clientX, e.clientY);
}

function panDragMove(e: MouseEvent) {
	inDrag.value = true;
	inPan.value = true;
	if (!e.buttons) {
		inDrag.value = false;
		dragAbort.abort();
		return;
	}
	const point = clientPointToPoint(e.clientX, e.clientY);
	const delta: [number, number] = [point[0] - panFrom[0], point[1] - panFrom[1]].map(d => d / zoomLevel.value) as [number, number];
	panFrom = point;
	pan(...delta);
}

function panDragStop() {
	clearInDrag();
	inPan.value = false;
	dragAbort.abort();
}

function targetDragStart(e: MouseEvent) {
	e.stopPropagation();
	dragEvents(targetDragMove, targetDragStop);
}

function targetDragMove(e: MouseEvent) {
	if (!e.buttons) {
		inDrag.value = false;
		dragAbort.abort();
		return;
	}
	inDrag.value = true;
	emitChange(clientPointToValue(e.clientX, e.clientY, snapToGrid.value));
}

function targetDragStop() {
	clearInDrag();
	dragAbort.abort();
}

function click(e: MouseEvent) {
	if (inDrag.value) return;
	emitChange(clientPointToValue(e.clientX, e.clientY, snapToGrid.value));
}

function entry() {
	const x = Number(inputXRef.value!.value);
	const y = Number(inputYRef.value!.value);
	if (isNaN(x) || isNaN(y)) return;
	emitChange([x, y]);
}

function pan(dx: number, dy: number) {
	panPosition.value = [
		panPosition.value[0] + dx,
		panPosition.value[1] + dy,
	];
}

function zoom(zoomMode: -1 | 0 | 1 = 0) {
	zoomLevel.value = ([zoomLevel.value / dimensions.zoomStep, 1, zoomLevel.value * dimensions.zoomStep])[zoomMode + 1];
}

function toggleSnap(e: Event) {
	snapToGrid.value = (e.target as HTMLInputElement).checked;
}

function emitChange(xy: [number, number]) {
	emit("change", { target: {
		name: props.name,
		id: props.id,
		value: xy
	}} as Eventish);
}
</script>

<template>
	<div class="vectorInput">
		<svg ref="gridSvg" :class="['gridSvg', {inDrag, inPan}]" xmlns="http://www.w3.org/2000/svg"
			 :style="styles"
			 :viewBox="[0, 0, ...clientWindow].join(' ')"
			 :width="clientWindow[0]" :height="clientWindow[1]"
			 @mousedown="panDragStart"
			 @click="click">
			<defs>
				<pattern :id="ns.id('minorGrid')" class="minorGrid"
						 :viewBox="[0, 0, scene.majorGrid.px / dimensions.gridSubdivs, scene.majorGrid.px / dimensions.gridSubdivs].join(' ')"
						 :width="scene.majorGrid.px / dimensions.gridSubdivs"
						 :height="scene.majorGrid.px / dimensions.gridSubdivs" patternUnits="userSpaceOnUse"
						 patternContentUnits="userSpaceOnUse">
					<rect :width="scene.majorGrid.px / dimensions.gridSubdivs" class="grid-line gl-minor"
						  :height="scene.majorGrid.px / dimensions.gridSubdivs"/>
				</pattern>

				<pattern :id="ns.id('grid')" class="majorGrid"
						 x="50%" y="50%"
						 :viewBox="[0, 0, scene.majorGrid.px, scene.majorGrid.px].join(' ')"
						 :width="scene.majorGrid.px" :height="scene.majorGrid.px" patternUnits="userSpaceOnUse"
						 patternContentUnits="userSpaceOnUse">
					<rect x="1" y="1" :width="scene.majorGrid.px - 2" :height="scene.majorGrid.px - 2"
						  :fill="ns.url('minorGrid')"/>
					<rect :width="scene.majorGrid.px" :height="scene.majorGrid.px" class="grid-line gl-major"/>
				</pattern>

				<symbol class="target" :id="ns.id('target')" viewBox="0 0 1 1" width="1" height="1">
					<rect class="hitbox"/>
					<use class="targetShadow" :href="ns.fragment('target-ch')"/>
					<g :id="ns.id('target-ch')" viewBox="0 0 1 1">
						<circle class="dot" cx="0.5" cy="0.5"/>
						<path class="crosshair" d="M 0.5 0 v 1 M 0 0.5 h 1"/>
					</g>
				</symbol>
			</defs>

			<rect width="100%" height="100%" :fill="ns.url('grid')"/>

			<!-- origin target -->
			<path class="originLines gl-major"
				  :d="['M', scene.clientZero[0], 0, 'V', scene.clientWindow[1], 'M', 0, scene.clientZero[1], 'H', scene.clientWindow[0]].join(' ')"/>
			<use class="targetInstance originTarget" :width="styles['--box-size']" :height="styles['--box-size']"
				 :href="ns.fragment('target')"/>

			<!-- Line from target to origin -->
			<path :d="['M', ...scene.clientZero, 'L', ...lineEndPos].join(' ')" stroke="#888" fill="none"
				  stroke-width="2" stroke-dasharray="0 4" stroke-linecap="round"/>

			<!-- target -->
			<use class="targetInstance positionTarget" :width="styles['--box-size']" :height="styles['--box-size']"
				 :href="ns.fragment('target')" @mousedown="targetDragStart"/>
		</svg>

		<div class="buttonColumn">
			<menu class="zoom buttons">
				<li>
					<button class="control" type="button" @click="zoom(1)">
						<img src="./zoom.svg#in" alt="Zoom In"/>
					</button>
				</li>
				<li>
					<button class="control" type="button" @click="zoom(0)">1x</button>
				</li>
				<li>
					<button class="control" type="button" @click="zoom(-1)">
						<img src="./zoom.svg#out" alt="Zoom Out"/>
					</button>
				</li>
			</menu>

			<menu class="gridSnap buttons">
				<label class="control toggle">
					<img src="./zoom.svg#grid" alt="Snap to Grid"/>
					<input type="checkbox" :checked="snapToGrid" @change="toggleSnap"/>
				</label>
			</menu>
		</div>
		<div class="typein">
			<label>X <input ref="inputX" type="number" :value="props.x" step="1" @input="entry" :id="props.id" /></label>
			<label>Y <input ref="inputY" type="number" :value="props.y" step="1" @input="entry"/></label>
			{{ (zoomLevel).toFixed(2) }}x / <span class="exampleGridSquare" title="1 Grid Square"></span> = {{ scene.majorGrid.gridSquareValue / dimensions.gridSubdivs }}
		</div>
	</div>
</template>

<style scoped lang="scss">
.vectorInput {
	display: grid;
	grid-template-columns: min-content min-content;

	--major-color: #8af;
	--minor-color: #adf;
}

menu.buttons {
	display: flex;
	flex-direction: column;
	list-style-type: none;
	margin: 0 1ch 1em 1ch;
	padding: 0;
	user-select: none;

	.control {
		appearance: none;
		margin: 0;
		padding: 0;
		width: 2em;
		aspect-ratio: 1 / 1.2;

		display: inline-flex;
		align-items: center;
		justify-content: center;

		border: 0 none;
		background-color: #fff;
		box-shadow: 3px 3px 2px #ccc;

		img {
			width: 1em;
			aspect-ratio: 1 / 1;
		}
	}

	li:first-child .control {
		border-top-left-radius: 20%;
		border-top-right-radius: 20%;
	}

	li .control {
		border-bottom: 1px solid #ccc;
	}

	li:last-child .control {
		border-bottom-left-radius: 20%;
		border-bottom-right-radius: 20%;
		border-bottom: none;
	}

	.control > input[type="checkbox"] {
		position: absolute;
		appearance: none;
		width: 0;
		height: 0;
		opacity: 0;
	}

	.control:has(:checked) {
		box-shadow: inset 2px 2px 2px #ccc;
	}
}

.gridSvg {
	border: 1px solid #000;
	user-select: none;
}

.gridSvg.inPan {
	cursor: grabbing;
}

.originLines {
	stroke-width: 3;
}

.majorGrid {
	transform: translateX(var(--client-pan-x)) translateY(var(--client-pan-y));
}

.grid-line {
	fill: none;
	stroke-width: 1px;
}

.gl-major {
	stroke: var(--major-color);
}

.gl-minor {
	stroke: var(--minor-color);
}

.targetInstance {
	transform: translate(calc(var(--box-size) * -0.5px), calc(var(--box-size) * -0.5px));
}

.target {
	--local-radius: calc(var(--dot-radius) / var(--box-size));
	--local-stroke-width: calc(1px * var(--box-stroke) / var(--box-size));
}

.crosshair {
	stroke-width: var(--local-stroke-width);
	stroke-dasharray: calc(0.4px - var(--local-radius)) calc(0.2px + 2 * var(--local-radius));
	stroke: var(--line-color);
}

.dot {
	fill: var(--dot-color);
	stroke: var(--circle-color);
	stroke-width: var(--local-stroke-width);
	r: calc(var(--dot-radius) / var(--box-size));
}

.originTarget {
	x: var(--zero-x);
	y: var(--zero-y);
	--circle-color: transparent;
	--dot-color: #aaa;
	--line-color: #aaa;
}

.positionTarget {
	--circle-color: #000;
	--dot-color: transparent;
	--line-color: #000;

	x: var(--target-x);
	y: var(--target-y);

	cursor: pointer;
}

.targetShadow {
	--line-color: #fff;
	--local-stroke-width: calc(3px * var(--box-stroke) / var(--box-size));
	--circle-color: transparent;
	--dot-color: transparent;
}

.hitbox {
	fill: transparent;
	x: 0;
	y: 0;
	width: 1px;
	height: 1px;
}

.typein {
	label:first-child {
		padding-inline-end: 1em;
	}

	input[type=number] {
		width: 4em;
	}
}

.exampleGridSquare {
	display: inline-block;
	width: 1ch;
	aspect-ratio: 1 / 1;
	vertical-align: middle;
	border: 3px solid var(--minor-color);
}
</style>
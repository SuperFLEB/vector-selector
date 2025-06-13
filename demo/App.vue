<script setup lang="ts">
import VectorInput, {type Eventish} from "@/VectorInput/VectorInput.vue";
import {type CSSProperties, ref} from "vue";
import RandomNamespace from "@/util/randomNamespace.ts";
const style = ref<CSSProperties>({});

type Values = {
	offset: [number, number];
	shadow: [number, number];
}
const positions = ref<Values>({
	offset: [0, 0],
	shadow: [0, 0],
});

function onChange(e: Eventish) {
	positions.value[e.target.name as keyof typeof positions.value] = e.target.value;
	style.value = {
		'text-shadow': `${positions.value.shadow[0]}px ${positions.value.shadow[1]}px 4px #888`,
		'transform': `translate(${positions.value.offset[0]}px, ${positions.value.offset[1]}px)`,
	};
}

const ns = new RandomNamespace();
</script>

<template>
	<div class="panels">
		<div class="inputForm">
			<label :for="ns.id('offset')">Offset</label>
			<div><VectorInput name="offset" :id="ns.id('offset')" :x="positions.offset[0]" :y="positions.offset[1]" :initialZoom="1" @change="onChange" /></div>
			<label :for="ns.id('shadow')">Drop Shadow Position</label>
			<div><VectorInput name="shadow" :id="ns.id('shadow')" :x="positions.shadow[0]" :y="positions.shadow[1]" :initialZoom="10" @change="onChange" /></div>
		</div>
		<div :style class="shadowed">Change position and shadow with the controls.</div>
	</div>
</template>

<style scoped>
	.panels {
		display: flex;
		flex-direction: row;
		flex-basis: 50% 50%;
		gap: 3em;
	}

	.inputForm {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 2em;
	}

	.inputForm label {
		font-size: 1.25em;
		font-family: sans-serif;
		background: linear-gradient(to right, #ccc, #fff);
		align-self: center;
		padding: 0.5em;
	}

	.shadowed {
		font-size: 40px;
		font-family: sans-serif;
		font-weight: bold;

		color: #fff;
		-webkit-text-stroke: 2px #000;
	}
</style>

/**
 * The demo catalogue: eight garments and five makeup looks.
 *
 * Framework-free data, read by both the front end (to render the picker) and the
 * capture script (to know what to submit).
 */

import type { Garment, MakeupLook } from './types.js';

export const GARMENTS: readonly Garment[] = [
  {
    id: 'ivory-silk-blouse',
    name: 'Ivory silk blouse',
    category: 'upper_body',
    dominantHex: '#efe6d8',
    colorName: 'Warm ivory',
  },
  {
    id: 'rosewater-cardigan',
    name: 'Rosewater cardigan',
    category: 'upper_body',
    dominantHex: '#e3b7bf',
    colorName: 'Soft rose',
  },
  {
    id: 'sage-linen-shirt',
    name: 'Sage linen shirt',
    category: 'upper_body',
    dominantHex: '#a8b49a',
    colorName: 'Pale sage',
  },
  {
    id: 'wisteria-knit',
    name: 'Wisteria knit',
    category: 'upper_body',
    dominantHex: '#c2b4d8',
    colorName: 'Wisteria',
  },
  {
    id: 'terracotta-wrap-top',
    name: 'Terracotta wrap top',
    category: 'upper_body',
    dominantHex: '#c07a55',
    colorName: 'Terracotta',
  },
  {
    id: 'butter-yellow-blouse',
    name: 'Butter yellow blouse',
    category: 'upper_body',
    dominantHex: '#ecd98f',
    colorName: 'Butter yellow',
  },
  {
    id: 'dusty-teal-top',
    name: 'Dusty teal top',
    category: 'upper_body',
    dominantHex: '#6d9b9b',
    colorName: 'Dusty teal',
  },
  {
    id: 'midnight-velvet-jacket',
    name: 'Midnight velvet jacket',
    category: 'upper_body',
    dominantHex: '#2f3550',
    colorName: 'Midnight blue',
  },
];

/**
 * Makeup looks.
 *
 * The current documented Makeup VTO endpoint takes an effects configuration rather
 * than a reference photograph. The server converts the selected look's display chips
 * into that provider payload; the vendor fields never reach the browser.
 */
export const MAKEUP_LOOKS: readonly MakeupLook[] = [
  {
    id: 'rose-veil',
    name: 'Rose Veil',
    description: 'A soft everyday flush — barely-there lip, warm rose cheek, clean lid.',
    chips: {
      lip: { hex: '#c9757a', name: 'Rosewater' },
      cheek: { hex: '#e2a3a4', name: 'Petal flush' },
      eye: { hex: '#c9ab97', name: 'Soft taupe' },
    },
  },
  {
    id: 'peach-ember',
    name: 'Peach Ember',
    description: 'Warm coral through lip and cheek, with a gilded wash on the lid.',
    chips: {
      lip: { hex: '#d9705a', name: 'Coral ember' },
      cheek: { hex: '#eaa184', name: 'Apricot glow' },
      eye: { hex: '#c99a5e', name: 'Gilded sand' },
    },
  },
  {
    id: 'berry-nocturne',
    name: 'Berry Nocturne',
    description: 'A deeper berry lip held against a quiet cheek and a soft smoked lid.',
    chips: {
      lip: { hex: '#8e3550', name: 'Mulberry' },
      cheek: { hex: '#c98a94', name: 'Dusk rose' },
      eye: { hex: '#6c5560', name: 'Smoked plum' },
    },
  },
  {
    id: 'champagne-halo',
    name: 'Champagne Halo',
    description: 'Neutral and luminous — a golden lid, bare cheek, and a warm nude lip.',
    chips: {
      lip: { hex: '#c08a72', name: 'Warm nude' },
      cheek: { hex: '#e0b09c', name: 'Bare peach' },
      eye: { hex: '#d8b47a', name: 'Champagne' },
    },
  },
  {
    id: 'wisteria-dusk',
    name: 'Wisteria Dusk',
    description: 'A cool mauve lid with a pink-leaning lip, kept low and soft.',
    chips: {
      lip: { hex: '#bf6f83', name: 'Mauve rose' },
      cheek: { hex: '#dda6b4', name: 'Cool blush' },
      eye: { hex: '#a993c0', name: 'Wisteria' },
    },
  },
];

export const findGarment = (id: string): Garment | undefined =>
  GARMENTS.find((garment) => garment.id === id);

export const findMakeupLook = (id: string): MakeupLook | undefined =>
  MAKEUP_LOOKS.find((look) => look.id === id);

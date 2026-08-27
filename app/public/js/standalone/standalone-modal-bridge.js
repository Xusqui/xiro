/**
 * @fileoverview Expone el modal compartido (módulo ES) como global
 * para los scripts clásicos de standalone.html
 */

import { mostrarModalInput } from '../shared/modal-input.js?v=20260828012635';

window.mostrarModalInput = mostrarModalInput;

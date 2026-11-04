/**
 * @fileoverview Expone el modal compartido (módulo ES) como global
 * para los scripts clásicos de standalone.html
 */

import { mostrarModalInput } from '../shared/modal-input.js?v=20260922172926';
import { mostrarModalConfirmacion } from '../shared/modal.js?v=20260922172926';

window.mostrarModalInput = mostrarModalInput;
window.mostrarModalConfirmacion = mostrarModalConfirmacion;

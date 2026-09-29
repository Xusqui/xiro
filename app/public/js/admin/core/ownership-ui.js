/**
 * @fileoverview Helpers de permisos visuales por ownership (admin/editor)
 */

function normalizeResourceOwnerRole(ownerRole) {
    return ownerRole === 'editor' ? 'editor' : 'admin';
}

function normalizeResourceOwnerUserId(ownerUserId) {
    const value = Number(ownerUserId);
    return Number.isInteger(value) && value > 0 ? value : null;
}

function resolveOwnerFromInput(ownerInput) {
    if (ownerInput && typeof ownerInput === 'object') {
        return {
            role: normalizeResourceOwnerRole(ownerInput.created_by_role || ownerInput.ownerRole),
            userId: normalizeResourceOwnerUserId(ownerInput.created_by_user_id ?? ownerInput.ownerUserId),
            username: String(ownerInput.created_by_username || ownerInput.ownerUsername || '').trim() || null
        };
    }

    return {
        role: normalizeResourceOwnerRole(ownerInput),
        userId: normalizeResourceOwnerUserId(ownerInput),
        username: null
    };
}

function escapeOwnerLabel(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function canModifyOwnedResource(ownerInput) {
    const currentRole = getUserRole();
    if (currentRole === 'admin') return true;
    if (currentRole !== 'editor') return false;

    const owner = resolveOwnerFromInput(ownerInput);
    const currentUserId = getCurrentUserId();

    if (owner.userId && currentUserId) {
        return owner.userId === currentUserId;
    }

    return owner.role === 'editor';
}

function getOwnerBadgeHtml(ownerInput) {
    const owner = resolveOwnerFromInput(ownerInput);
    const currentUserId = getCurrentUserId();
    const currentUsername = String(getCurrentUsername() || '').trim();
    const creatorName = escapeOwnerLabel(
        owner.username || (owner.userId && currentUserId === owner.userId ? currentUsername : null) || 'Desconocido'
    );

    const createdByLabel = _t('admin.common.created_by', null, 'Creado por');
    if (owner.role === 'editor') {
        return `<span class="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[11px] font-bold"><i class="fas fa-user-edit"></i> ${createdByLabel} ${creatorName}</span>`;
    }
    return `<span class="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-1 rounded-lg text-[11px] font-bold"><i class="fas fa-user-shield"></i> ${createdByLabel} ${creatorName}</span>`;
}

function getLockedButtonClasses() {
    return 'opacity-50 cursor-not-allowed bg-slate-300 hover:bg-slate-300 text-slate-500';
}

function showOwnershipDeniedModal(resourceLabel = 'este recurso') {
    mostrarModalError(
        'Recurso protegido',
        `No puedes modificar ${resourceLabel} porque fue creado por otro usuario.`,
        'warning'
    );
}

export function renderCard({ color, icon, step, title, text, placeholderId, imgSrc, mascotImg, isSmall = false }) {
    const stepHtml = step ? `<div class="step-badge" style="background-color: ${color};">${step}</div>` : '';
    const layoutClasses = isSmall
        ? 'flex-col md:flex-row items-center md:items-start'
        : 'flex-col lg:flex-row items-center justify-between';

    const imageContent = imgSrc
        ? `<img src="${imgSrc}" alt="${title}" class="img-zoom-hover h-40 sm:h-56 w-auto rounded-xl border-2 border-slate-200 shadow-md bg-white">`
        : `<div id="${placeholderId}" class="h-40 sm:h-56 bg-slate-200 border-2 border-dashed border-slate-400 rounded-xl flex items-center justify-center text-slate-400 font-bold shadow-inner" style="aspect-ratio: 9/16;">
            <div class="text-center p-2">
                <i class="fas fa-camera text-2xl mb-2 block"></i>
                <span class="text-[10px] uppercase tracking-wide">Captura: ${placeholderId}</span>
            </div>
        </div>`;

    return `
    <div class="card h-full relative">
        <div class="bg-white/85 backdrop-blur-md h-full rounded-3xl shadow-xl p-6 lg:p-8 text-slate-800 border-b-8 flex ${layoutClasses} gap-6"
            style="border-bottom-color: ${color};">
            <div class="flex-1 w-full text-left">
                ${stepHtml}
                <h2 class="text-xl font-black mb-2 text-slate-800 flex items-center">
                    <i class="${icon} mr-3" style="color: ${color};"></i> ${title}
                </h2>
                <div class="text-slate-600 text-base space-y-2">
                    ${text}
                </div>
            </div>
            
            <div class="flex flex-col items-center gap-4 shrink-0">
                ${imageContent}
                ${mascotImg ? `<img src="./images/chamaleon/${mascotImg}" alt="Mascota" class="w-16 h-16 object-contain mt-2">` : ''}
            </div>
        </div>
    </div>`;
}

export function renderSmallVerticalCard({ color, icon, title, text, placeholderId, imgSrc, mascotImg }) {
    const imageContent = imgSrc
        ? `<img src="${imgSrc}" alt="${title}" class="img-zoom-hover small h-32 sm:h-40 w-auto rounded-lg border-2 border-slate-200 shadow-md bg-white">`
        : `<div id="${placeholderId}" class="h-32 sm:h-40 bg-slate-200 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center text-slate-400 shadow-inner" style="aspect-ratio: 9/16;">
            <div class="text-center text-[10px] leading-tight font-bold p-1">
                <i class="fas fa-image block mb-1 text-base"></i>
                ${placeholderId}
            </div>
        </div>`;

    return `
    <div class="card h-full relative">
        <div class="bg-white/85 backdrop-blur-md h-full rounded-2xl shadow-lg p-5 text-slate-800 border-2 flex flex-col gap-4"
            style="border-color: ${color};">
            <div class="flex items-center gap-3">
                <div class="bg-slate-100 p-3 rounded-full shrink-0">
                    <i class="${icon} text-xl" style="color: ${color};"></i>
                </div>
                <h3 class="text-lg font-bold">${title}</h3>
            </div>
            <div class="text-slate-600 text-sm">
                ${text}
            </div>
            
            <div class="mt-auto flex justify-between items-end gap-2">
                ${mascotImg ? `<img src="./images/chamaleon/${mascotImg}" alt="Mascota" class="w-36 h-36 object-contain">` : '<div class="w-36"></div>'}
                ${imageContent}
            </div>
        </div>
    </div>`;
}

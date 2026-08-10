import { renderCard, renderSmallVerticalCard } from './ui-components.js?v=20260810122358';

export function getTabPuntuacionHTML() {
    const scores = [
        {
            color: '#22c55e', icon: 'fas fa-check-circle',
            title: _t('manual_player.score.exact.title'),
            text: _t('manual_player.score.exact.text'),
            placeholderId: 'img-score-green', imgSrc: './images/manual/img-score-green.jpg', mascotImg: 'party.svg'
        },
        {
            color: '#eab308', icon: 'fas fa-exclamation-triangle',
            title: _t('manual_player.score.approx.title'),
            text: _t('manual_player.score.approx.text'),
            placeholderId: 'img-score-yellow', imgSrc: './images/manual/img-score-yellow.jpg', mascotImg: 'thinking.svg'
        },
        {
            color: '#ef4444', icon: 'fas fa-times-circle',
            title: _t('manual_player.score.fail.title'),
            text: _t('manual_player.score.fail.text'),
            placeholderId: 'img-score-red', imgSrc: './images/manual/img-score-red.jpg', mascotImg: 'angry.svg'
        }
    ];

    const streaks = [
        {
            color: '#f97316', icon: 'fas fa-fire',
            title: _t('manual_player.score.streak.title'),
            text: _t('manual_player.score.streak.text'),
            placeholderId: 'img-score-streak', imgSrc: './images/manual/img-score-streak.jpg', mascotImg: 'cool.svg', isSmall: true
        },
        {
            color: '#f43f5e', icon: 'fas fa-fire-flame-curved',
            title: _t('manual_player.score.double.title'),
            text: _t('manual_player.score.double.text'),
            placeholderId: 'img-score-double', imgSrc: './images/manual/img-score-double.jpg', mascotImg: 'love.svg', isSmall: true
        }
    ];

    const scoresHtml = scores.map(s => renderSmallVerticalCard(s)).join('');
    const streaksHtml = streaks.map(s => renderCard(s)).join('');

    return `
        <div class="mb-4 text-center">
            <h2 class="text-2xl font-bold text-white mb-2">${_t('manual_player.score.section.title')}</h2>
            <p class="text-indigo-200">${_t('manual_player.score.section.subtitle')}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 anim-fade-in mb-8">${scoresHtml}</div>

        <div class="bg-indigo-900/40 rounded-3xl p-6 border border-indigo-400/20 text-left mb-6 anim-fade-in" style="animation-delay: 0.1s;">
            <h3 class="text-xl font-bold text-white mb-4"><i class="fas fa-meteor text-orange-400 mr-2"></i> ${_t('manual_player.score.streak_section.title')}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${streaksHtml}</div>
        </div>
    `;
}

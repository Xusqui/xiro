import { renderCard } from './ui-components.js?v=20260824101409';

export function getTabTrivialHTML() {
    const steps = [
        {
            color: '#e65453', icon: 'fas fa-dice', step: '1',
            title: _t('manual_player.trivial.s1.title'),
            text: _t('manual_player.trivial.s1.text'),
            placeholderId: 'img-trivial-dice', imgSrc: './images/manual/img-trivial-dice.jpg', mascotImg: 'gaming.svg', isSmall: true
        },
        {
            color: '#0891b2', icon: 'fas fa-map-marked-alt', step: '2',
            title: _t('manual_player.trivial.s2.title'),
            text: _t('manual_player.trivial.s2.text'),
            placeholderId: 'img-trivial-board', imgSrc: './images/manual/img-trivial-board.jpg', mascotImg: 'searching.svg', isSmall: true
        },
        {
            color: '#f9b518', icon: 'fas fa-question-circle', step: '3',
            title: _t('manual_player.trivial.s3.title'),
            text: _t('manual_player.trivial.s3.text'),
            placeholderId: 'img-trivial-q', imgSrc: './images/manual/img-quiz.jpg', mascotImg: 'thinking.svg', isSmall: true
        }
    ];

    const cardsHtml = steps.map(s => renderCard(s)).join('');

    return `
        <div class="mb-4 text-center">
            <h2 class="text-2xl font-bold text-white mb-2">${_t('manual_player.trivial.section.title')}</h2>
            <p class="text-indigo-200">${_t('manual_player.trivial.section.subtitle')}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 anim-fade-in">${cardsHtml}</div>
    `;
}

import { renderSmallVerticalCard } from './ui-components.js?v=20260922074829';

export function getTabResponderHTML() {
    const types = [
        {
            color: '#8ab817', icon: 'fas fa-check-circle',
            title: _t('manual_player.answer.quiz.title'),
            text: _t('manual_player.answer.quiz.text'),
            placeholderId: 'img-quiz', imgSrc: './images/manual/img-quiz.jpg', mascotImg: 'thinking.svg'
        },
        {
            color: '#10b981', icon: 'fas fa-image',
            title: _t('manual_player.answer.quiz_img.title'),
            text: _t('manual_player.answer.quiz_img.text'),
            placeholderId: 'img-quiz-img', imgSrc: './images/manual/img-quiz-img.jpg', mascotImg: 'hello.svg'
        },
        {
            color: '#14b8a6', icon: 'fas fa-music',
            title: _t('manual_player.answer.quiz_music.title'),
            text: _t('manual_player.answer.quiz_music.text'),
            placeholderId: 'img-quiz-music', imgSrc: './images/manual/img-quiz-music.jpg', mascotImg: 'party.svg'
        },
        {
            color: '#0ea5e9', icon: 'fas fa-poll',
            title: _t('manual_player.answer.survey.title'),
            text: _t('manual_player.answer.survey.text'),
            placeholderId: 'img-survey', imgSrc: './images/manual/img-survey.jpg', mascotImg: 'cool.svg'
        },
        {
            color: '#a855f7', icon: 'fas fa-check-double',
            title: _t('manual_player.answer.multiple.title'),
            text: _t('manual_player.answer.multiple.text'),
            placeholderId: 'img-multiple', imgSrc: './images/manual/img-multiple.jpg', mascotImg: 'disguise.svg'
        },
        {
            color: '#f59e0b', icon: 'fas fa-sort-numeric-up-alt',
            title: _t('manual_player.answer.numeric.title'),
            text: _t('manual_player.answer.numeric.text'),
            placeholderId: 'img-numeric', imgSrc: './images/manual/img-numeric.jpg', mascotImg: 'nerd.svg'
        },
        {
            color: '#ec4899', icon: 'fas fa-list-ol',
            title: _t('manual_player.answer.order.title'),
            text: _t('manual_player.answer.order.text'),
            placeholderId: 'img-order', imgSrc: './images/manual/img-order.jpg', mascotImg: 'worker.svg'
        },
        {
            color: '#ef4444', icon: 'fas fa-font',
            title: _t('manual_player.answer.scramble.title'),
            text: _t('manual_player.answer.scramble.text'),
            placeholderId: 'img-scramble', imgSrc: './images/manual/img-scramble.jpg', mascotImg: 'angry.svg'
        },
        {
            color: '#f59e0b', icon: 'fas fa-link',
            title: _t('manual_player.answer.matching.title'),
            text: _t('manual_player.answer.matching.text'),
            placeholderId: 'img-matching', imgSrc: './images/manual/img-matching.jpg', mascotImg: 'cooking.svg'
        }
    ];

    const cardsHtml = types.map(t => renderSmallVerticalCard(t)).join('');

    return `
        <div class="mb-4 text-center">
            <h2 class="text-2xl font-bold text-white mb-2">${_t('manual_player.answer.section.title')}</h2>
            <p class="text-indigo-200">${_t('manual_player.answer.section.subtitle')}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 anim-fade-in">${cardsHtml}</div>
    `;
}

import { renderCard } from './ui-components.js?v=20260708133604';

export function getTabUnirseHTML() {
    const steps = [
        {
            color: '#8ab817', icon: 'fas fa-globe', step: '1',
            title: _t('manual_player.join.s1.title'),
            text: _t('manual_player.join.s1.text'),
            placeholderId: 'img-login-qr', imgSrc: './images/manual/img-login-qr.jpg', mascotImg: 'hello.svg', isSmall: true
        },
        {
            color: '#f9b518', icon: 'fas fa-key', step: '2',
            title: _t('manual_player.join.s2.title'),
            text: _t('manual_player.join.s2.text'),
            placeholderId: 'img-login-pin', imgSrc: './images/manual/img-login-pin.jpg', mascotImg: 'searching.svg', isSmall: true
        },
        {
            color: '#e65453', icon: 'fas fa-user-tag', step: '3',
            title: _t('manual_player.join.s3.title'),
            text: _t('manual_player.join.s3.text'),
            placeholderId: 'img-login-nick', imgSrc: './images/manual/img-login-nick.jpg', mascotImg: 'disguise.svg', isSmall: true
        },
        {
            color: '#a855f7', icon: 'fas fa-users', step: '4',
            title: _t('manual_player.join.s4.title'),
            text: _t('manual_player.join.s4.text'),
            placeholderId: 'img-login-team', imgSrc: './images/manual/img-login-team.jpg', mascotImg: 'cool.svg', isSmall: true
        },
        {
            color: '#0891b2', icon: 'fas fa-hourglass-start', step: '5',
            title: _t('manual_player.join.s5.title'),
            text: _t('manual_player.join.s5.text'),
            placeholderId: 'img-login-wait', imgSrc: './images/manual/img-login-wait.jpg', mascotImg: 'gaming.svg', isSmall: true
        }
    ];

    const cardsHtml = steps.map(s => renderCard(s)).join('');

    return `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 anim-fade-in">${cardsHtml}</div>`;
}

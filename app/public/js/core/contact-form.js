/**
 * @fileoverview Formulario de contacto: pide el desafío antibot y envía el mensaje.
 */
(function () {
    let form = document.getElementById('contact-form');
    let tokenInput = document.getElementById('contact-token');
    let questionEl = document.getElementById('captcha-question');
    let submitBtn = document.getElementById('submit-btn');
    let errorMsg = document.getElementById('error-msg');
    let successMsg = document.getElementById('success-msg');

    function loadToken() {
        fetch('/api/contact/token')
            .then(function (r) {
                return r.json();
            })
            .then(function (data) {
                tokenInput.value = data.token;
                questionEl.textContent = data.question;
            })
            .catch(function () {
                questionEl.textContent = 'Error al cargar. Recarga la página.';
            });
    }

    function readResult(response) {
        return response.json().then(function (data) {
            return { ok: response.ok, data: data };
        });
    }

    loadToken();

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        errorMsg.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando...';

        let payload = {
            name: document.getElementById('cnt-name').value,
            email: document.getElementById('cnt-email').value,
            message: document.getElementById('cnt-message').value,
            captcha: document.getElementById('cnt-captcha').value,
            token: tokenInput.value,
            website: document.getElementById('website').value,
            privacyAccepted: document.getElementById('cnt-privacy').checked
        };

        fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(readResult)
            .then(function (res) {
                if (res.ok) {
                    form.classList.add('hidden');
                    document.getElementById('reply-email').textContent = payload.email;
                    successMsg.classList.remove('hidden');
                } else {
                    errorMsg.textContent = res.data.error || 'Error al enviar. Inténtalo de nuevo.';
                    errorMsg.classList.remove('hidden');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar mensaje';
                    loadToken();
                    document.getElementById('cnt-captcha').value = '';
                }
            })
            .catch(function () {
                errorMsg.textContent = 'Error de conexión. Comprueba tu red e inténtalo de nuevo.';
                errorMsg.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar mensaje';
            });
    });
})();

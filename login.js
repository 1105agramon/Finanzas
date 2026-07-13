// Tu URL oficial y segura creada con Cloudflare
const API_URL = 'https://finanzas.juangranados.org';

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault(); // Evita que la página se recargue

    const correo = document.getElementById('correo').value;
    const password = document.getElementById('password').value;
    const mensajeError = document.getElementById('mensaje-error');
    const btnLogin = document.getElementById('btn-login');

    // Cambiar estado del botón mientras carga
    btnLogin.textContent = "Verificando...";
    btnLogin.disabled = true;
    mensajeError.className = 'error-oculto';

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                correo: correo,
                password: password
            })
        });

        if (response.ok) {
            // Login exitoso: el backend nos devuelve el objeto con id, nombre y correo
            const usuario = await response.json();
            
            // 1. Guardamos los datos del usuario en el navegador
            localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));
            
            // 2. 🛑 EL MENSAJE DE CONFIRMACIÓN 🛑
            // Usamos las comillas invertidas (backticks) para poder inyectar las variables
            alert(`¡Acceso concedido!\n\nUsuario: ${usuario.nombre}\nCorreo: ${usuario.correo}`);
            
            // 3. Redirigimos al panel principal SOLAMENTE después de que el usuario cierre la alerta
            window.location.href = 'dashboard.html';
            
        } else {
            // Contraseña incorrecta o usuario no encontrado
            mensajeError.className = 'error-visible';
            btnLogin.textContent = "Ingresar";
            btnLogin.disabled = false;
        }
    } catch (error) {
        console.error("Error conectando con el servidor:", error);
        mensajeError.textContent = "Error de conexión con el servidor.";
        mensajeError.className = 'error-visible';
        
        btnLogin.textContent = "Ingresar";
        btnLogin.disabled = false;
    }
});
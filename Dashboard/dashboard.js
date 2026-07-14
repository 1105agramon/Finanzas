// URL de tu túnel seguro
const API_URL = 'https://finanzas.juangranados.org';

// 1. Verificación de Seguridad (Proteger la ruta)
const usuarioStorage = localStorage.getItem('usuarioLogueado');

if (!usuarioStorage) {
    // Si no hay datos en memoria, lo pateamos al login y detenemos la ejecución
    window.location.replace('../index.html');
    throw new Error("No hay sesión activa, deteniendo ejecución...");
}

// Convertimos el string de memoria a un objeto real
const usuario = JSON.parse(usuarioStorage);

// Variables globales para controlar la gráfica y los filtros
let miGrafica = null;
let gastosGlobales = []; // Guardará los gastos para poder filtrarlos sin consultar la BD de nuevo

// 2. Eventos al Cargar la Página
document.addEventListener('DOMContentLoaded', () => {
    // Colocar el nombre en el Header
    document.getElementById('bienvenida-usuario').textContent = `Hola, ${usuario.nombre}`;
    
    // Cargar toda la información de la base de datos
    cargarDatosDashboard();
});

// 3. Botón de Cerrar Sesión
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('usuarioLogueado');
    window.location.href = '../index.html';
});

// 4. Función Principal para traer los datos
async function cargarDatosDashboard() {
    try {
        // Ejecutamos las 4 consultas al mismo tiempo para que sea rápido
        // Agregamos { cache: 'no-store' } para obligar al navegador a traer datos frescos de MariaDB
        const [resIngresos, resGastos, resTarjetas, resMsi] = await Promise.all([
            fetch(`${API_URL}/api/finanzas/ingresos/usuario/${usuario.id}`, { cache: 'no-store' }),
            fetch(`${API_URL}/api/gastos/usuario/${usuario.id}`, { cache: 'no-store' }),
            fetch(`${API_URL}/api/tarjetas/usuario/${usuario.id}`, { cache: 'no-store' }),
            fetch(`${API_URL}/api/msi/pendientes`, { cache: 'no-store' }) // Este endpoint trae todos los pendientes globales
        ]);

        const ingresos = await resIngresos.json();
        const gastos = await resGastos.json();
        const tarjetas = await resTarjetas.json();
        const msiPendientes = await resMsi.json();

        gastosGlobales = gastos; // Guardamos la lista en memoria


        // ==========================================
        // LÓGICA INTELIGENTE: ¿Ya existe una quincena?
        // ==========================================
        if (ingresos.length > 0) {
            // Cambiamos el texto del botón principal
            document.getElementById('btn-nueva-quincena').textContent = '✎ Modificar Quincena';
            
            // Pre-llenamos los inputs del modal oculto para que veas tu salario actual
            document.getElementById('monto-quincena').value = ingresos[0].salarioQuincenal;
            document.getElementById('fecha-quincena').value = ingresos[0].fechaDeposito;
        }
        // ==========================================

        // 5. Cálculos Matemáticos para los Widgets
        
        // Sumar todos los ingresos
        let totalIngresos = ingresos.reduce((acc, current) => acc + current.salarioQuincenal, 0);
        
        // Sumar todos los gastos
        let totalGastos = gastos.reduce((acc, current) => acc + current.montoTotal, 0);
        
        // Actualizar el HTML de los widgets
        document.getElementById('widget-salario').textContent = formatearMoneda(totalIngresos);
        document.getElementById('widget-gastado').textContent = formatearMoneda(totalGastos);
        document.getElementById('widget-tarjetas').textContent = tarjetas.length;

        // 6. Generar la Gráfica
        dibujarGrafica(totalIngresos, totalGastos);

        // 7. Llenar la Tabla de MSI
        llenarTablaMsi(msiPendientes);

        // 8. Llenar el Historial de Gastos
        llenarTablaHistorial(gastosGlobales);

    } catch (error) {
        console.error("Error al cargar los datos del dashboard:", error);
    }
}

// 8. Lógica de la Gráfica (Chart.js)
function dibujarGrafica(ingreso, gasto) {
    const ctx = document.getElementById('graficaFinanzas').getContext('2d');
    
    // Si ya existe una gráfica previa, la destruimos antes de redibujar para evitar errores visuales
    if (miGrafica) {
        miGrafica.destroy();
    }
    
    miGrafica = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Resumen Financiero'],
            datasets: [
                {
                    label: 'Ingresos',
                    data: [ingreso],
                    backgroundColor: '#10b981', // Verde actualizado
                    borderRadius: 5
                },
                {
                    label: 'Gastos',
                    data: [gasto],
                    backgroundColor: '#ef4444', // Rojo actualizado
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 9. Lógica de la Tabla MSI
function llenarTablaMsi(pendientes) {
    const tbody = document.getElementById('msi-body');
    tbody.innerHTML = ''; // Limpiamos el "Cargando..."

    if (pendientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No tienes pagos pendientes. ¡Excelente!</td></tr>';
        return;
    }

    pendientes.forEach(item => {
        // Creamos una fila por cada mensualidad pendiente
        const tr = document.createElement('tr');
        
        // Como el backend devuelve el objeto 'gasto' anidado, podemos acceder a su concepto
        const conceptoStr = item.gasto ? item.gasto.concepto : 'Gasto sin concepto';

        tr.innerHTML = `
            <td>${conceptoStr}</td>
            <td>${item.mensualidadActual} de ${item.mensualidadesTotales}</td>
            <td style="color: #ef4444; font-weight: bold;">${formatearMoneda(item.montoPorMes)}</td>
            <td style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    ${item.fechaProximoVencimiento} <br>
                    <span class="badge-pendiente">Pendiente</span>
                </div>
                <button onclick="registrarPagoMsi(${item.id})" class="btn-primario" style="padding: 6px 12px; font-size: 0.8em; background-color: var(--success-color);">
                    ✔ Pagar Mes
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Utilidad para darle formato de pesos mexicanos a los números
function formatearMoneda(cantidad) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(cantidad);
}

/* =========================================
   LÓGICA DE LOS MODALES Y FORMULARIOS
========================================= */

// Obtener elementos del DOM
const modalQuincena = document.getElementById('modal-quincena');
const modalTarjeta = document.getElementById('modal-tarjeta');
const modalGasto = document.getElementById('modal-gasto');

// Lógica para mostrar/ocultar el campo de meses sin intereses
document.getElementById('es-msi').addEventListener('change', function() {
    const divMeses = document.getElementById('div-meses');
    divMeses.style.display = this.checked ? 'block' : 'none';
});

// Función para abrir modales
document.getElementById('btn-nueva-quincena').onclick = () => modalQuincena.style.display = "block";
document.getElementById('btn-nueva-tarjeta').onclick = () => modalTarjeta.style.display = "block";
document.getElementById('btn-nuevo-gasto').onclick = async () => {
    modalGasto.style.display = "block";
    
    // Al abrir el modal de gastos, necesitamos llenar la lista de tarjetas
    const resTarjetas = await fetch(`${API_URL}/api/tarjetas/usuario/${usuario.id}`);
    const tarjetas = await resTarjetas.json();
    
    const selectTarjeta = document.getElementById('tarjeta-gasto');
    selectTarjeta.innerHTML = ''; // Limpiamos opciones anteriores
    
    if (tarjetas.length === 0) {
        selectTarjeta.innerHTML = '<option disabled selected>Primero debes agregar una tarjeta</option>';
    } else {
        tarjetas.forEach(t => {
            selectTarjeta.innerHTML += `<option value="${t.id}">${t.aliasTarjeta} (${t.tipoTarjeta})</option>`;
        });
    }
};

// Función para cerrar modales (con la X o dando clic afuera)
const closeBtns = document.querySelectorAll('.close-btn');
closeBtns.forEach(btn => {
    btn.onclick = function() {
        modalQuincena.style.display = "none";
        modalTarjeta.style.display = "none";
        modalGasto.style.display = "none";
    }
});
window.onclick = function(event) {
    if (event.target == modalQuincena) modalQuincena.style.display = "none";
    if (event.target == modalTarjeta) modalTarjeta.style.display = "none";
    if (event.target == modalGasto) modalGasto.style.display = "none";
}

/* =========================================
   ENVÍO DE DATOS AL BACKEND (POST)
========================================= */

// 1. Guardar Quincena
document.getElementById('form-quincena').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        usuario: { id: usuario.id }, // Spring Boot necesita saber de quién es
        salarioQuincenal: parseFloat(document.getElementById('monto-quincena').value),
        fechaDeposito: document.getElementById('fecha-quincena').value
    };

    const res = await fetch(`${API_URL}/api/finanzas/ingresos/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert("Quincena registrada exitosamente");
        modalQuincena.style.display = "none";
        // Ya no reseteamos el formulario aquí para mantener los datos visibles en la próxima apertura
        cargarDatosDashboard(); // Recargar gráficas
    }
});


// 2. Guardar Tarjeta
document.getElementById('form-tarjeta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        usuario: { id: usuario.id },
        aliasTarjeta: document.getElementById('alias-tarjeta').value,
        tipoTarjeta: document.getElementById('tipo-tarjeta').value,
        diaCorte: document.getElementById('dia-corte').value || null,
        diaLimitePago: document.getElementById('dia-limite-pago').value || null
    };

    const res = await fetch(`${API_URL}/api/tarjetas/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert("Tarjeta agregada exitosamente");
        modalTarjeta.style.display = "none";
        document.getElementById('form-tarjeta').reset();
        cargarDatosDashboard(); 
    }
});

// 3. Guardar Gasto (Con o sin MSI)
document.getElementById('form-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const esMsi = document.getElementById('es-msi').checked;
    const meses = document.getElementById('meses-totales').value;

    const data = {
        usuario: { id: usuario.id },
        tarjeta: { id: document.getElementById('tarjeta-gasto').value },
        concepto: document.getElementById('concepto-gasto').value,
        montoTotal: parseFloat(document.getElementById('monto-gasto').value),
        categoria: document.getElementById('categoria-gasto').value,
        fechaCompra: new Date().toISOString().split('T')[0], // Fecha de hoy automática
        esMsi: esMsi
    };

    // Si es a meses, la URL cambia un poco según armamos el controlador
    const url = esMsi 
        ? `${API_URL}/api/gastos/registrar?mesesTotales=${meses}` 
        : `${API_URL}/api/gastos/registrar`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        alert("Gasto registrado exitosamente");
        modalGasto.style.display = "none";
        document.getElementById('form-gasto').reset();
        document.getElementById('div-meses').style.display = "none";
        cargarDatosDashboard(); 
    }
});

/* =========================================
   LÓGICA DEL HISTORIAL Y FILTROS
========================================= */

// Función para pintar la tabla del historial
function llenarTablaHistorial(listaGastos) {
    const tbody = document.getElementById('historial-body');
    tbody.innerHTML = ''; // Limpiamos el "Cargando..."

    if (listaGastos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay gastos para mostrar.</td></tr>';
        return;
    }

    // Ordenar por fecha (los más recientes primero)
    const gastosOrdenados = [...listaGastos].sort((a, b) => new Date(b.fechaCompra) - new Date(a.fechaCompra));

    gastosOrdenados.forEach(gasto => {
        const tr = document.createElement('tr');
        
        // Formatear la fecha a un modo legible
        // Como guardamos "YYYY-MM-DD", le agregamos "T00:00:00" para evitar desfases de zona horaria
        const fechaObj = new Date(gasto.fechaCompra + 'T00:00:00');
        const fechaStr = fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
        
        // Extraer los datos de las relaciones
        const tarjetaStr = gasto.tarjeta ? `${gasto.tarjeta.aliasTarjeta}` : 'Efectivo/Otro';
        
        // Etiqueta visual para distinguir si fue a meses o de contado
        const tipoBadge = gasto.esMsi 
            ? '<span class="badge-pendiente" style="background-color: var(--accent-color);">MSI</span>' 
            : '<span style="color: var(--text-muted); font-weight: 600;">Contado</span>';

        tr.innerHTML = `
            <td style="font-weight: 600;">${fechaStr}</td>
            <td>${gasto.concepto}</td>
            <td>${gasto.categoria}</td>
            <td>${tarjetaStr}</td>
            <td>${tipoBadge}</td>
            <td style="color: var(--error-color); font-weight: bold;">${formatearMoneda(gasto.montoTotal)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Evento para escuchar cuando el usuario cambia el filtro
document.getElementById('filtro-categoria').addEventListener('change', function() {
    const categoriaSeleccionada = this.value;
    
    if (categoriaSeleccionada === 'TODAS') {
        // Si elige "Todas", mandamos la lista original completa
        llenarTablaHistorial(gastosGlobales);
    } else {
        // Filtramos usando la función nativa de JavaScript
        const gastosFiltrados = gastosGlobales.filter(gasto => gasto.categoria === categoriaSeleccionada);
        llenarTablaHistorial(gastosFiltrados);
    }
});

// Función para registrar el pago de una mensualidad
async function registrarPagoMsi(idMsi) {
    // Pedimos confirmación para evitar clics accidentales
    if (!confirm("¿Confirmas que ya realizaste el pago de esta mensualidad?")) {
        return;
    }

    try {
        // Hacemos la petición al backend para que actualice la mensualidad
        const res = await fetch(`${API_URL}/api/msi/pagar/${idMsi}`, {
            method: 'PUT', // Usamos PUT porque estamos actualizando un registro existente
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            alert("¡Pago registrado exitosamente!");
            cargarDatosDashboard(); // Recargamos el panel para que desaparezca o avance el mes
        } else {
            alert("Hubo un problema al registrar el pago.");
        }
    } catch (error) {
        console.error("Error al registrar el pago MSI:", error);
    }
}
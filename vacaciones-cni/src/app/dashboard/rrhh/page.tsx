"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Swal from 'sweetalert2';
import { useUsuarios, type Usuario, type FiltrosUsuarios } from '@/hooks/useUsuarios';
import { useDepartamentos, useConfiguracion } from '@/hooks'; // Nueva arquitectura
import { notificationService } from '@/services';
import { useGestionDias } from '@/hooks/useGestionDias';
import ModalUsuario from '@/components/ModalUsuario';

interface Metrics {
  usuarios_totales: number;
  usuarios_activos: number;
  solicitudes_pendientes: number;
  en_vacaciones: number;
  departamentos_count: number;
  dias_promedio: number;
}

export default function RRHHDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  
  // Usar el hook personalizado para usuarios
  const { usuarios, loading, error, cargarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario } = useUsuarios();
  
  // Hook para obtener departamentos desde la nueva arquitectura reactiva
  const { departamentos, refrescar: refetchDepartamentos } = useDepartamentos();
  
  // Hook para gestión de días
  const { 
    estadisticas: estadisticasDias, 
    loading: loadingDias, 
    error: errorDias,
    cargarEstadisticas,
    realizarAsignacionMasiva,
    realizarAsignacionIndividual
  } = useGestionDias();
  
  // Hook para configuración usando la nueva arquitectura reactiva
  const {
    todasLasConfiguraciones: configuraciones,
    cargando: loadingConfiguracion,
    actualizar: actualizarConfiguraciones,
    obtenerPorCategoria,
    debug: debugConfiguracion
  } = useConfiguracion();
  
  const errorConfiguracion = null; // La nueva arquitectura maneja errores internamente
  
  // Debug de configuraciones
  // Debug de configuraciones (solo cuando cambian los datos, no la función)
  useEffect(() => {
    console.log('🔍 PÁGINA RRHH - Estado de configuraciones:', {
      configuraciones,
      keys: Object.keys(configuraciones),
      length: Object.keys(configuraciones).length,
      loadingConfiguracion
    });
    
    if (typeof debugConfiguracion === 'function') {
      debugConfiguracion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuraciones, loadingConfiguracion]); // No incluir debugConfiguracion
  
  // Estados para modales
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | undefined>(undefined);
  
  // Estados para filtros
  const [filtros, setFiltros] = useState<FiltrosUsuarios>({});
  
  // Estados para gestión de días
  const [formAsignacionMasiva, setFormAsignacionMasiva] = useState({
    departamento: '',
    nuevos_dias: '',
    modo: 'reemplazar' as 'reemplazar' | 'sumar' | 'restar',
    motivo: ''
  });
  
  const [formAsignacionIndividual, setFormAsignacionIndividual] = useState({
    usuario_id: '',
    nuevos_dias: '',
    modo: 'reemplazar' as 'reemplazar' | 'sumar' | 'restar',
    motivo: ''
  });
  
  // Estados para configuración
  const [configuracionesEditadas, setConfiguracionesEditadas] = useState<Record<string, string>>({});
  const [configuracionesOriginales, setConfiguracionesOriginales] = useState<Record<string, string>>({});
  
  const [loadingData, setLoadingData] = useState(false);

  // Cargar datos iniciales solo una vez
  useEffect(() => {
    // Cargar usuarios reales de la API solo una vez al montar el componente
    cargarUsuarios();
    
    // Cargar estadísticas de días
    cargarEstadisticas();
    
    // DEBUG: Forzar carga de configuraciones para debugging
    console.log('🔄 RRHH: Forzando carga de configuraciones...');
    console.log('📊 Estado actual configuraciones:', configuraciones);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo al montar

  // Actualizar métricas cuando cambien los departamentos
  useEffect(() => {
    // Simulamos métricas por ahora (luego conectaremos a la API real)
    if (departamentos.length > 0) {
      setMetrics({
        usuarios_totales: 21,
        usuarios_activos: 20,
        solicitudes_pendientes: 3,
        en_vacaciones: 2,
        departamentos_count: departamentos.length,
        dias_promedio: 18.5,
      });
    }
  }, [departamentos.length]); // Solo cuando cambia el número de departamentos

  // ✅ NO necesitamos efectos adicionales - la nueva arquitectura es reactiva

  // Handlers para el CRUD
  const handleCrearUsuario = () => {
    setUsuarioEditando(undefined);
    setModalAbierto(true);
  };

  const handleEditarUsuario = (usuario: Usuario) => {
    setUsuarioEditando(usuario);
    setModalAbierto(true);
  };

  const handleCerrarModal = () => {
    setModalAbierto(false);
    setUsuarioEditando(undefined);
  };

  const handleEliminarUsuario = async (id: string) => {
    // Buscar información del usuario para mostrar en la confirmación
    const usuario = usuarios.find(u => u.id === id);
    const nombreCompleto = usuario ? `${usuario.nombre} ${usuario.apellido}` : 'este usuario';

    const result = await Swal.fire({
      title: '¿Estás seguro?',
      html: `¿Deseas eliminar a <strong>${nombreCompleto}</strong>?<br><small>Esta acción no se puede deshacer</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      const deleteResult = await eliminarUsuario(id);
      if (deleteResult.ok) {
        await Swal.fire({
          title: '¡Eliminado!',
          text: `${nombreCompleto} ha sido eliminado correctamente`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      } else {
        await Swal.fire({
          title: 'Error',
          text: deleteResult.error || 'Error al eliminar el usuario',
          icon: 'error',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#d33'
        });
      }
    }
  };

  const handleSubmitUsuario = async (usuarioData: any) => {
    if (usuarioEditando) {
      // Actualizar
      return await actualizarUsuario(usuarioData);
    } else {
      // Crear
      return await crearUsuario(usuarioData);
    }
  };

  // Funciones para gestión de días
  const handleAsignacionMasiva = async () => {
    if (!formAsignacionMasiva.departamento || !formAsignacionMasiva.nuevos_dias || !formAsignacionMasiva.motivo) {
      await Swal.fire({
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const result = await Swal.fire({
      title: '¿Confirmar asignación masiva?',
      html: `¿${formAsignacionMasiva.modo === 'reemplazar' ? 'Asignar' : 
             formAsignacionMasiva.modo === 'sumar' ? 'Sumar' : 'Restar'} <strong>${formAsignacionMasiva.nuevos_dias} días</strong> ${
             formAsignacionMasiva.modo === 'reemplazar' ? 'a' : 
             formAsignacionMasiva.modo === 'sumar' ? 'a los días actuales de' : 'de los días actuales de'} todos los usuarios del departamento <strong>${formAsignacionMasiva.departamento}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, asignar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const asignacion = await realizarAsignacionMasiva({
        departamento: formAsignacionMasiva.departamento,
        nuevos_dias: Number(formAsignacionMasiva.nuevos_dias),
        modo: formAsignacionMasiva.modo,
        motivo: formAsignacionMasiva.motivo,
        realizado_por: '1' // TODO: Obtener del usuario logueado
      });

      if (asignacion.ok) {
        await Swal.fire({
          title: '¡Éxito!',
          text: asignacion.message,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        
        // Limpiar formulario
        setFormAsignacionMasiva({
          departamento: '',
          nuevos_dias: '',
          modo: 'reemplazar',
          motivo: ''
        });
        
        // Recargar usuarios para ver los cambios
        cargarUsuarios();
      } else {
        await Swal.fire({
          title: 'Error',
          text: asignacion.error || 'Error en la asignación',
          icon: 'error',
          confirmButtonText: 'Entendido'
        });
      }
    }
  };

  const handleAsignacionIndividual = async () => {
    if (!formAsignacionIndividual.usuario_id || !formAsignacionIndividual.nuevos_dias || !formAsignacionIndividual.motivo) {
      await Swal.fire({
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const usuario = usuarios.find(u => u.id === formAsignacionIndividual.usuario_id);
    const nombreUsuario = usuario ? `${usuario.nombre} ${usuario.apellido}` : 'el usuario seleccionado';

    const result = await Swal.fire({
      title: '¿Confirmar asignación individual?',
      html: `¿${formAsignacionIndividual.modo === 'reemplazar' ? 'Asignar' : 
             formAsignacionIndividual.modo === 'sumar' ? 'Sumar' : 'Restar'} <strong>${formAsignacionIndividual.nuevos_dias} días</strong> ${
             formAsignacionIndividual.modo === 'reemplazar' ? 'a' : 
             formAsignacionIndividual.modo === 'sumar' ? 'a los días actuales de' : 'de los días actuales de'} <strong>${nombreUsuario}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, asignar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const asignacion = await realizarAsignacionIndividual({
        usuario_id: formAsignacionIndividual.usuario_id,
        nuevos_dias: Number(formAsignacionIndividual.nuevos_dias),
        modo: formAsignacionIndividual.modo,
        motivo: formAsignacionIndividual.motivo,
        realizado_por: '1' // TODO: Obtener del usuario logueado
      });

      if (asignacion.ok) {
        await Swal.fire({
          title: '¡Éxito!',
          text: asignacion.message,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        
        // Limpiar formulario
        setFormAsignacionIndividual({
          usuario_id: '',
          nuevos_dias: '',
          modo: 'reemplazar',
          motivo: ''
        });
        
        // Recargar usuarios para ver los cambios
        cargarUsuarios();
      } else {
        await Swal.fire({
          title: 'Error',
          text: asignacion.error || 'Error en la asignación',
          icon: 'error',
          confirmButtonText: 'Entendido'
        });
      }
    }
  };

  // Funciones para configuración
  const handleConfiguracionChange = (clave: string, valor: string) => {
    setConfiguracionesEditadas(prev => ({
      ...prev,
      [clave]: valor
    }));
  };

  const handleGuardarConfiguraciones = async (categoria: string) => {
    const configuracionesCategoria = configuraciones[categoria] || [];
    const configuracionesActualizar = configuracionesCategoria
      .map(config => {
        const valorEditado = configuracionesEditadas[config.clave];
        if (valorEditado !== undefined && valorEditado !== config.valor) {
          return {
            clave: config.clave,
            valor: valorEditado,
            descripcion: config.descripcion,
            tipo: config.tipo,
            categoria: config.categoria
          };
        }
        return null;
      })
      .filter(Boolean);

    if (configuracionesActualizar.length === 0) {
      notificationService.info('No hay cambios para guardar');
      return;
    }

    const confirmado = await notificationService.confirm(
      '¿Confirmar cambios?',
      `¿Guardar ${configuracionesActualizar.length} configuración(es) modificada(s)?`
    );

    if (!confirmado) return;

    // ✅ Usar la nueva arquitectura - maneja todo automáticamente
    const exito = await actualizarConfiguraciones(configuracionesActualizar as any, '1');
    
    if (exito) {
      // Limpiar configuraciones editadas
      setConfiguracionesEditadas({});
      
      // ✅ La nueva arquitectura actualiza automáticamente todos los componentes reactivos
      // No necesitamos recargar manualmente ni hacer actualizaciones optimistas
    }
  };

  const obtenerValorMostrado = (config: any) => {
    const valorEditado = configuracionesEditadas[config.clave];
    return valorEditado !== undefined ? valorEditado : config.valor;
  };

  const handleFiltroChange = (campo: string, valor: string) => {
    const nuevosFiltros = { ...filtros, [campo]: valor };
    setFiltros(nuevosFiltros);
    cargarUsuarios(nuevosFiltros);
  };

  const TabButton = ({ id, label, icon, isActive, onClick }: {
    id: string;
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`tab tab-bordered ${isActive ? 'tab-active' : ''} flex items-center gap-2 px-6 py-3`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-base-200" data-theme="light">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg border-b border-base-300">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative">
              <Image
                src="/assets/logo/logo.png"
                alt="CNI Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold">CNI Vacaciones</h1>
              <p className="text-xs text-base-content/60">Panel de Recursos Humanos</p>
            </div>
          </div>
        </div>
        <div className="flex-none gap-2">
          <div className="form-control">
            <input type="text" placeholder="Buscar..." className="input input-bordered w-24 md:w-auto" />
          </div>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full bg-secondary text-secondary-content flex items-center justify-center">
                <span className="text-sm font-bold">YG</span>
              </div>
            </div>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li className="menu-title">Yenfri Garcia</li>
              <li><a><i className="lni lni-user"></i> Mi Perfil</a></li>
              <li><a><i className="lni lni-cog"></i> Configuración</a></li>
              <li><a href="/login"><i className="lni lni-exit"></i> Cerrar Sesión</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-base-100 border-b">
        <div className="container mx-auto">
          <div className="tabs tabs-boxed bg-transparent">
            <TabButton
              id="overview"
              label="Resumen"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              isActive={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            />
            <TabButton
              id="users"
              label="Usuarios"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197v1z" /></svg>}
              isActive={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
            />
            <TabButton
              id="days"
              label="Gestión Días"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              isActive={activeTab === 'days'}
              onClick={() => setActiveTab('days')}
            />
            <TabButton
              id="config"
              label="Configuración"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              isActive={activeTab === 'config'}
              onClick={() => setActiveTab('config')}
            />
            <TabButton
              id="reports"
              label="Reportes"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              isActive={activeTab === 'reports'}
              onClick={() => setActiveTab('reports')}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6 bg-base-200">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Page Title */}
            <div className="mb-6 bg-base-100 p-6 rounded-lg shadow-sm border border-base-300">
              <h1 className="text-3xl font-bold text-base-content">Dashboard RRHH</h1>
              <p className="text-base-content/60">Panel de control para la gestión integral del sistema de vacaciones</p>
            </div>

            {/* Metrics Cards */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="card bg-base-100 shadow-lg border border-base-300">
                    <div className="card-body">
                      <div className="skeleton h-4 w-20"></div>
                      <div className="skeleton h-8 w-16 mt-2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Total Usuarios */}
                <div className="card bg-base-100 shadow-lg border-l-4 border-primary">
                  <div className="card-body">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-sm text-base-content/60 font-medium">Total Usuarios</h2>
                        <p className="text-3xl font-bold text-base-content">{metrics?.usuarios_totales}</p>
                      </div>
                    </div>
                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm mt-2">
                      Activos: {metrics?.usuarios_activos}
                    </div>
                  </div>
                </div>

                {/* Solicitudes Pendientes */}
                <div className="card bg-base-100 shadow-lg border-l-4 border-warning">
                  <div className="card-body">
                    <div className="flex items-center gap-3">
                      <div className="bg-warning/10 p-2 rounded-lg">
                        <svg className="w-8 h-8 text-warning" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-sm text-base-content/60 font-medium">Pendientes</h2>
                        <p className="text-3xl font-bold text-base-content">{metrics?.solicitudes_pendientes}</p>
                      </div>
                    </div>
                    <div className="bg-warning/10 text-warning px-3 py-1 rounded-full text-sm mt-2">
                      Requieren acción
                    </div>
                  </div>
                </div>

                {/* En Vacaciones */}
                <div className="card bg-base-100 shadow-lg border-l-4 border-accent">
                  <div className="card-body">
                    <div className="flex items-center gap-3">
                      <div className="bg-accent/10 p-2 rounded-lg">
                        <svg className="w-8 h-8 text-accent" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-sm text-base-content/60 font-medium">En Vacaciones</h2>
                        <p className="text-3xl font-bold text-base-content">{metrics?.en_vacaciones}</p>
                      </div>
                    </div>
                    <div className="bg-accent/10 text-accent px-3 py-1 rounded-full text-sm mt-2">
                      Hoy
                    </div>
                  </div>
                </div>

                {/* Departamentos */}
                <div className="card bg-secondary text-secondary-content shadow-xl">
                  <div className="card-body">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 opacity-80" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 2h2v2H7V6zm2 4H7v2h2v-2zm2-4h2v2h-2V6zm2 4h-2v2h2v-2z" clipRule="evenodd"/>
                      </svg>
                      <div>
                        <h2 className="text-sm opacity-90 font-medium">Departamentos</h2>
                        <p className="text-3xl font-bold">{metrics?.departamentos_count}</p>
                      </div>
                    </div>
                    <div className="badge badge-secondary-content mt-2">Áreas CNI</div>
                  </div>
                </div>

                {/* Promedio Días */}
                <div className="card bg-info text-info-content shadow-xl">
                  <div className="card-body">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 opacity-80" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                      </svg>
                      <div>
                        <h2 className="text-sm opacity-90 font-medium">Promedio Días</h2>
                        <p className="text-3xl font-bold">{metrics?.dias_promedio}</p>
                      </div>
                    </div>
                    <div className="badge badge-info-content mt-2">Disponibles</div>
                  </div>
                </div>

                {/* Acciones Rápidas */}
                <div className="card bg-neutral text-neutral-content shadow-xl">
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-3">
                      <svg className="w-8 h-8 opacity-80" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
                      </svg>
                      <h2 className="text-sm opacity-90 font-medium">Acciones Rápidas</h2>
                    </div>
                    <div className="space-y-2">
                      <button 
                        onClick={() => setActiveTab('users')}
                        className="btn btn-sm btn-outline w-full"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                        </svg>
                        Nuevo Usuario
                      </button>
                      <button 
                        onClick={() => setActiveTab('config')}
                        className="btn btn-sm btn-outline w-full"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        Configurar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actividad Reciente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Actividad Reciente
                  </h2>
                  <div className="space-y-3 mt-4">
                    <div className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                      <div className="badge badge-success"><i className="lni lni-checkmark"></i></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Solicitud Aprobada</p>
                        <p className="text-xs text-base-content/60">Aida Sandoval - 3 días (Nov 10-12)</p>
                        <p className="text-xs text-base-content/40">Hace 1 hora</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                      <div className="badge badge-warning"><i className="lni lni-hourglass"></i></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Nueva Solicitud</p>
                        <p className="text-xs text-base-content/60">Luis Martinez - 5 días (Nov 15-19)</p>
                        <p className="text-xs text-base-content/40">Hace 2 horas</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                      <div className="badge badge-info"><i className="lni lni-user"></i></div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Usuario Actualizado</p>
                        <p className="text-xs text-base-content/60">Carmen Rivera - Días ajustados a 21</p>
                        <p className="text-xs text-base-content/40">Hace 3 horas</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    Estadísticas del Mes
                  </h2>
                  <div className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Solicitudes Procesadas</span>
                      <span className="badge badge-success">15</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Días Utilizados</span>
                      <span className="badge badge-info">87</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Usuarios Nuevos</span>
                      <span className="badge badge-primary">3</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Configuraciones Actualizadas</span>
                      <span className="badge badge-secondary">2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usuarios Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-base-100 p-6 rounded-lg shadow-sm border border-base-300">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-base-content">Gestión de Usuarios</h2>
                  <p className="text-base-content/60">Administra todos los usuarios del sistema</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      console.log('🔄 Actualizando departamentos con nueva arquitectura...');
                      refetchDepartamentos();
                    }}
                    className="bg-accent hover:bg-accent/80 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                    title="Actualizar departamentos"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Actualizar
                  </button>
                  <button 
                    onClick={handleCrearUsuario}
                    className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Nuevo Usuario
                  </button>
                </div>
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-base-100 rounded-lg shadow-sm border border-base-300">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-base-content mb-4">Filtros de Búsqueda</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select 
                    value={filtros.departamento || 'Todos los departamentos'}
                    onChange={(e) => handleFiltroChange('departamento', e.target.value)}
                    className="select select-bordered w-full"
                  >
                    <option>Todos los departamentos</option>
                    {departamentos.map(dept => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <select 
                    value={filtros.rol || 'Todos los roles'}
                    onChange={(e) => handleFiltroChange('rol', e.target.value)}
                    className="select select-bordered w-full"
                  >
                    <option>Todos los roles</option>
                    <option>empleado</option>
                    <option>jefe_superior</option>
                    <option>rrhh</option>
                  </select>
                  <select 
                    value={filtros.estado || 'Todos los estados'}
                    onChange={(e) => handleFiltroChange('estado', e.target.value)}
                    className="select select-bordered w-full"
                  >
                    <option>Todos los estados</option>
                    <option>Activos</option>
                    <option>Inactivos</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Buscar por nombre..." 
                    value={filtros.buscar || ''}
                    onChange={(e) => handleFiltroChange('buscar', e.target.value)}
                    className="input input-bordered w-full"
                  />
                </div>
              </div>
            </div>

            {/* Tabla de Usuarios */}
            <div className="bg-base-100 rounded-lg shadow-sm border border-base-300">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-base-content mb-4">Lista de Usuarios</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="text-left py-3 px-4 font-semibold text-base-content">Usuario</th>
                        <th className="text-left py-3 px-4 font-semibold text-base-content">Rol</th>
                        <th className="text-left py-3 px-4 font-semibold text-base-content">Departamento</th>
                        <th className="text-left py-3 px-4 font-semibold text-base-content">Días Disponibles</th>
                        <th className="text-left py-3 px-4 font-semibold text-base-content">Estado</th>
                        <th className="text-left py-3 px-4 font-semibold text-base-content">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((user) => (
                        <tr key={user.id} className="border-b border-base-300 hover:bg-base-200 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {user.nombre.charAt(0)}{user.apellido.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="font-semibold text-base-content">{user.nombre} {user.apellido}</div>
                                <div className="text-sm text-base-content/60">{user.email}</div>
                                <div className="text-xs text-base-content/40">{user.numero_empleado}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              user.rol === 'rrhh' ? 'bg-secondary/10 text-secondary' :
                              user.rol === 'jefe_superior' ? 'bg-info/10 text-info' : 'bg-base-300 text-base-content'
                            }`}>
                              {user.rol}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-base-content">{user.departamento}</td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base-content">{user.dias_disponibles}</span>
                              <span className="text-xs text-base-content/40">días</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              user.activo ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                            }`}>
                              {user.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleEditarUsuario(user)}
                                className="p-2 text-base-content/40 hover:text-info hover:bg-info/10 rounded-lg transition-colors" 
                                title="Editar usuario"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                              </button>
                              <button 
                                className="p-2 text-base-content/40 hover:text-success hover:bg-success/10 rounded-lg transition-colors" 
                                title="Ver detalles"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                              </button>
                              <button 
                                onClick={() => handleEliminarUsuario(user.id)}
                                className="p-2 text-base-content/40 hover:text-error hover:bg-error/10 rounded-lg transition-colors" 
                                title="Eliminar usuario"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gestión de Días Tab */}
        {activeTab === 'days' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Gestión de Días de Vacaciones</h2>
                <p className="text-base-content/60">Administra los saldos y asignaciones de días</p>
              </div>
              <button 
                onClick={() => {
                  console.log('🔄 Actualizando departamentos en gestión de días...');
                  refetchDepartamentos();
                }}
                className="bg-accent hover:bg-accent/80 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                title="Actualizar departamentos"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar Departamentos
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Asignación Masiva */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title"><i className="lni lni-target"></i> Asignación Masiva</h3>
                  <div className="space-y-4">
                    <select 
                      className="select select-bordered w-full"
                      value={formAsignacionMasiva.departamento}
                      onChange={(e) => setFormAsignacionMasiva(prev => ({ ...prev, departamento: e.target.value }))}
                    >
                      <option value="">Seleccionar departamento</option>
                      <option value="Todos los departamentos">Todos los departamentos</option>
                      {departamentos.map(dept => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      placeholder="Días a asignar" 
                      className="input input-bordered w-full"
                      value={formAsignacionMasiva.nuevos_dias}
                      onChange={(e) => setFormAsignacionMasiva(prev => ({ ...prev, nuevos_dias: e.target.value }))}
                    />
                    
                    {/* Modo de asignación */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">¿Cómo aplicar los días?</span>
                      </label>
                      <select 
                        className="select select-bordered w-full"
                        value={formAsignacionMasiva.modo}
                        onChange={(e) => setFormAsignacionMasiva(prev => ({ 
                          ...prev, 
                          modo: e.target.value as 'reemplazar' | 'sumar' | 'restar'
                        }))}
                      >
                        <option value="reemplazar">↻ Reemplazar días actuales</option>
                        <option value="sumar">+ Sumar a días actuales</option>
                        <option value="restar">− Restar de días actuales</option>
                      </select>
                    </div>
                    <textarea 
                      placeholder="Motivo de la asignación..." 
                      className="textarea textarea-bordered w-full"
                      value={formAsignacionMasiva.motivo}
                      onChange={(e) => setFormAsignacionMasiva(prev => ({ ...prev, motivo: e.target.value }))}
                    ></textarea>
                    <button 
                      className="btn btn-primary w-full"
                      onClick={handleAsignacionMasiva}
                      disabled={loadingDias}
                    >
                      {loadingDias ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Asignando...
                        </>
                      ) : (
                        'Asignar Días'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Ajustes Individuales */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title"><i className="lni lni-user"></i> Ajuste Individual</h3>
                  <div className="space-y-4">
                    <select 
                      className="select select-bordered w-full"
                      value={formAsignacionIndividual.usuario_id}
                      onChange={(e) => setFormAsignacionIndividual(prev => ({ ...prev, usuario_id: e.target.value }))}
                    >
                      <option value="">Seleccionar usuario</option>
                      {usuarios.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.nombre} {user.apellido} - {user.departamento}
                        </option>
                      ))}
                    </select>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">
                          Días actuales: {
                            formAsignacionIndividual.usuario_id 
                              ? usuarios.find(u => u.id === formAsignacionIndividual.usuario_id)?.dias_disponibles || 0
                              : 0
                          }
                        </span>
                      </label>
                      <input 
                        type="number" 
                        placeholder="Nuevos días disponibles" 
                        className="input input-bordered"
                        value={formAsignacionIndividual.nuevos_dias}
                        onChange={(e) => setFormAsignacionIndividual(prev => ({ ...prev, nuevos_dias: e.target.value }))}
                      />
                    </div>
                    
                    {/* Modo de asignación */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">¿Cómo aplicar los días?</span>
                      </label>
                      <select 
                        className="select select-bordered w-full"
                        value={formAsignacionIndividual.modo}
                        onChange={(e) => setFormAsignacionIndividual(prev => ({ 
                          ...prev, 
                          modo: e.target.value as 'reemplazar' | 'sumar' | 'restar'
                        }))}
                      >
                        <option value="reemplazar">↻ Reemplazar días actuales</option>
                        <option value="sumar">+ Sumar a días actuales</option>
                        <option value="restar">− Restar de días actuales</option>
                      </select>
                    </div>
                    <textarea 
                      placeholder="Motivo del ajuste..." 
                      className="textarea textarea-bordered w-full"
                      value={formAsignacionIndividual.motivo}
                      onChange={(e) => setFormAsignacionIndividual(prev => ({ ...prev, motivo: e.target.value }))}
                    ></textarea>
                    <button 
                      className="btn btn-secondary w-full"
                      onClick={handleAsignacionIndividual}
                      disabled={loadingDias}
                    >
                      {loadingDias ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Actualizando...
                        </>
                      ) : (
                        'Actualizar Días'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Historial de Cambios */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title"><i className="lni lni-clipboard"></i> Historial de Cambios</h3>
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Usuario</th>
                        <th>Cambio</th>
                        <th>Motivo</th>
                        <th>Realizado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>04/11/2025</td>
                        <td>Carmen Rivera</td>
                        <td><span className="badge badge-info">18 → 21 días</span></td>
                        <td>Ajuste anual</td>
                        <td>Yenfri Garcia</td>
                      </tr>
                      <tr>
                        <td>03/11/2025</td>
                        <td>Aida Sandoval</td>
                        <td><span className="badge badge-warning">21 → 18 días</span></td>
                        <td>Días utilizados</td>
                        <td>Sistema</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuración Tab */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Configuración del Sistema</h2>
              <p className="text-base-content/60">Gestiona las políticas y configuraciones generales</p>
            </div>

            {loadingConfiguracion ? (
              <div className="flex justify-center items-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
                <span className="ml-3">Cargando configuraciones...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* DEBUG: Mostrar estado de configuraciones */}
                <div className="alert alert-info mb-4">
                  <div>
                    <div className="font-bold">🐛 DEBUG - Estado de Configuraciones:</div>
                    <div>Configuraciones: {JSON.stringify(Object.keys(configuraciones))}</div>
                    <div>Total categorías: {Object.keys(configuraciones).length}</div>
                    <div>Cargando: {loadingConfiguracion ? 'Sí' : 'No'}</div>
                  </div>
                </div>
                
                {/* Configuraciones por categoría */}
                {(() => {
                  console.log('🔍 RENDERIZANDO CONFIGURACIONES:', {
                    configuraciones,
                    keys: Object.keys(configuraciones),
                    length: Object.keys(configuraciones).length,
                    isEmpty: Object.keys(configuraciones).length === 0
                  });
                  return null;
                })()}
                
                {Object.keys(configuraciones).length === 0 ? (
                  <div className="alert alert-warning">
                    <div>
                      <div className="font-bold flex items-center gap-2"><i className="lni lni-warning"></i> No hay configuraciones disponibles</div>
                      <div>Las configuraciones no se han cargado o están vacías.</div>
                    </div>
                  </div>
                ) : (
                  Object.entries(configuraciones).map(([categoria, configs]) => (
                  <div key={categoria} className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                      <h3 className="card-title capitalize">
                        {categoria === 'vacaciones' && <><i className="lni lni-sun"></i> Políticas de Vacaciones</>}
                        {categoria === 'notificaciones' && <><i className="lni lni-envelope"></i> Notificaciones</>}
                        {categoria === 'sistema' && <><i className="lni lni-cog"></i> Sistema</>}
                        {categoria === 'departamentos' && <><i className="lni lni-apartment"></i> Departamentos</>}
                        {categoria === 'general' && <><i className="lni lni-clipboard"></i> General</>}
                        {!['vacaciones', 'notificaciones', 'sistema', 'departamentos', 'general'].includes(categoria) && <><i className="lni lni-folder"></i> {categoria}</>}
                      </h3>
                      
                      <div className="space-y-4">
                        {configs.map((config) => (
                          <div key={config.clave} className="form-control">
                            <label className="label">
                              <span className="label-text font-medium">{config.descripcion || config.clave}</span>
                              <span className="label-text-alt text-xs opacity-60">
                                {config.tipo} • {config.clave}
                              </span>
                            </label>
                            
                            {config.tipo === 'boolean' ? (
                              <input 
                                type="checkbox" 
                                className="toggle toggle-primary"
                                checked={obtenerValorMostrado(config) === 'true'}
                                onChange={(e) => handleConfiguracionChange(config.clave, e.target.checked.toString())}
                              />
                            ) : config.tipo === 'numero' ? (
                              <input 
                                type="number" 
                                className="input input-bordered"
                                value={obtenerValorMostrado(config)}
                                onChange={(e) => handleConfiguracionChange(config.clave, e.target.value)}
                                placeholder={config.descripcion}
                              />
                            ) : config.tipo === 'fecha' ? (
                              <input 
                                type="date" 
                                className="input input-bordered"
                                value={obtenerValorMostrado(config)}
                                onChange={(e) => handleConfiguracionChange(config.clave, e.target.value)}
                              />
                            ) : config.tipo === 'select' && config.opciones ? (
                              <select 
                                className="select select-bordered"
                                value={obtenerValorMostrado(config)}
                                onChange={(e) => handleConfiguracionChange(config.clave, e.target.value)}
                              >
                                {config.opciones.map(opcion => (
                                  <option key={opcion} value={opcion}>{opcion}</option>
                                ))}
                              </select>
                            ) : (
                              <textarea 
                                className="textarea textarea-bordered"
                                value={obtenerValorMostrado(config)}
                                onChange={(e) => handleConfiguracionChange(config.clave, e.target.value)}
                                placeholder={config.descripcion}
                                rows={config.valor.length > 50 ? 3 : 1}
                              />
                            )}
                            
                            {configuracionesEditadas[config.clave] !== undefined && 
                             configuracionesEditadas[config.clave] !== config.valor && (
                              <div className="badge badge-warning badge-sm mt-1">
                                Modificado
                              </div>
                            )}
                          </div>
                        ))}
                        
                        <button 
                          className="btn btn-primary w-full mt-6"
                          onClick={() => handleGuardarConfiguraciones(categoria)}
                          disabled={loadingConfiguracion}
                        >
                          {loadingConfiguracion ? (
                            <>
                              <span className="loading loading-spinner loading-sm"></span>
                              Guardando...
                            </>
                          ) : (
                            `💾 Guardar ${categoria}`
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  ))
                )}

                {/* Si no hay configuraciones, mostrar mensaje */}
                {Object.keys(configuraciones).length === 0 && !loadingConfiguracion && (
                  <div className="card bg-base-100 shadow-xl">
                    <div className="card-body text-center">
                      <h3 className="card-title justify-center flex items-center gap-2"><i className="lni lni-warning"></i> Sin Configuraciones</h3>
                      <p className="text-base-content/60">
                        No se encontraron configuraciones en el sistema.
                      </p>
                      <button 
                        className="btn btn-primary"
                        onClick={() => refetchDepartamentos()}
                      >
                        🔄 Recargar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reportes Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Reportes y Estadísticas</h2>
              <p className="text-base-content/60">Análisis y reportes del sistema de vacaciones</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reportes Rápidos */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title">📈 Reportes Rápidos</h3>
                  <div className="space-y-3">
                    <button className="btn btn-outline w-full justify-start">
                      <i className="lni lni-bar-chart"></i> Usuarios por Departamento
                    </button>
                    <button className="btn btn-outline w-full justify-start">
                      <i className="lni lni-sun"></i> Vacaciones por Mes
                    </button>
                    <button className="btn btn-outline w-full justify-start">
                      <i className="lni lni-hourglass"></i> Solicitudes Pendientes
                    </button>
                    <button className="btn btn-outline w-full justify-start">
                      <i className="lni lni-wallet"></i> Días No Utilizados
                    </button>
                    <button className="btn btn-outline w-full justify-start">
                      <i className="lni lni-stats-up"></i> Estadísticas Generales
                    </button>
                  </div>
                </div>
              </div>

              {/* Reporte Personalizado */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title">🎨 Reporte Personalizado</h3>
                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Período</span>
                      </label>
                      <div className="flex gap-2">
                        <input type="date" className="input input-bordered flex-1" />
                        <input type="date" className="input input-bordered flex-1" />
                      </div>
                    </div>
                    <select className="select select-bordered w-full">
                      <option>Todos los departamentos</option>
                      {departamentos.map(dept => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <select className="select select-bordered w-full">
                      <option>Tipo de reporte</option>
                      <option>Resumen ejecutivo</option>
                      <option>Detallado</option>
                      <option>Solo métricas</option>
                    </select>
                    <button className="btn btn-primary w-full">Generar Reporte</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráficos Placeholder */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">📊 Tendencias del Año</h3>
                <div className="bg-base-200 rounded-lg p-8 text-center">
                  <p className="text-base-content/60">Gráficos de tendencias próximamente...</p>
                  <p className="text-sm text-base-content/40 mt-2">Aquí se mostrarán gráficos interactivos con las estadísticas del sistema</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal para crear/editar usuarios */}
      <ModalUsuario
        isOpen={modalAbierto}
        onClose={handleCerrarModal}
        onSubmit={handleSubmitUsuario}
        usuario={usuarioEditando}
        loading={loading}
      />
    </div>
  );
}
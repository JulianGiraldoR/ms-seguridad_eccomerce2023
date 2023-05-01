import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest';
import {Credenciales, FactorDeAutenticacionPorCodigo, Login, Usuario} from '../models';
import {LoginRepository, UsuarioRepository} from '../repositories';
import { AuthService, NotificacionesService, SeguridadUsuarioService } from '../services';
import { service } from '@loopback/core';
import { authenticate } from '@loopback/authentication';
import { ConfiguracionSeguridad } from '../config/seguridad.config';
import { ConfiguracionNotificacion } from '../config/notificaciones.config';

export class UsuarioController {
  constructor(
    @repository(UsuarioRepository)
    public usuarioRepository : UsuarioRepository,
    @service(SeguridadUsuarioService)
    public servicioSeguridad: SeguridadUsuarioService,
    @repository(LoginRepository)
    public repositorioLogin: LoginRepository,
    @service(AuthService)
    private servicioAuth: AuthService,
    @service(NotificacionesService)
    public servicioNotificaciones:NotificacionesService,
  ) {}

  @post('/usuario')
  @response(200, {
    description: 'Usuario model instance',
    content: {'application/json': {schema: getModelSchemaRef(Usuario)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Usuario, {
            title: 'NewUsuario',
            exclude: ['_id'],
          }),
        },
      },
    })
    usuario: Omit<Usuario, '_id'>,
  ): Promise<Usuario> {

    //crear clave

    let clave = this.servicioSeguridad.crearTextoAleatorio(10);
    console.log(clave)
    //cifrar clave
    let claveCifrada = this.servicioSeguridad.cifrarTexto(clave);
    // asignar la clave al usuario
    usuario.clave = claveCifrada;
    // enviar correo de notificacion
    return this.usuarioRepository.create(usuario);
  }

  @get('/usuario/count')
  @response(200, {
    description: 'Usuario model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Usuario) where?: Where<Usuario>,
  ): Promise<Count> {
    return this.usuarioRepository.count(where);
  }

  @authenticate({
    strategy:"auth",
    options:[ConfiguracionSeguridad.menuUsuarioId, ConfiguracionSeguridad.listarAccion]
  })
  @get('/usuario')
  @response(200, {
    description: 'Array of Usuario model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Usuario, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Usuario) filter?: Filter<Usuario>,
  ): Promise<Usuario[]> {
    return this.usuarioRepository.find(filter);
  }

  @patch('/usuario')
  @response(200, {
    description: 'Usuario PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Usuario, {partial: true}),
        },
      },
    })
    usuario: Usuario,
    @param.where(Usuario) where?: Where<Usuario>,
  ): Promise<Count> {
    return this.usuarioRepository.updateAll(usuario, where);
  }

  @get('/usuario/{id}')
  @response(200, {
    description: 'Usuario model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Usuario, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Usuario, {exclude: 'where'}) filter?: FilterExcludingWhere<Usuario>
  ): Promise<Usuario> {
    return this.usuarioRepository.findById(id, filter);
  }

  @patch('/usuario/{id}')
  @response(204, {
    description: 'Usuario PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Usuario, {partial: true}),
        },
      },
    })
    usuario: Usuario,
  ): Promise<void> {
    await this.usuarioRepository.updateById(id, usuario);
  }

  @put('/usuario/{id}')
  @response(204, {
    description: 'Usuario PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() usuario: Usuario,
  ): Promise<void> {
    await this.usuarioRepository.replaceById(id, usuario);
  }

  @del('/usuario/{id}')
  @response(204, {
    description: 'Usuario DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.usuarioRepository.deleteById(id);
  }

  /**
   * metodos personalizados para la API
   * 
   */

  @post('/identificar-usuario')
  @response(200, {
    description: "Identificar un usuario por correo y clave",
    content: {'application/json': {schema: getModelSchemaRef(Usuario)}}
  })
  async identificarUsuario(
    @requestBody(
      {
        content: {
          'application/json': {
            schema: getModelSchemaRef(Credenciales)
          }
        }
      }
    )
    credenciales: Credenciales
  ): Promise<object> {
    let usuario = await this.servicioSeguridad.identificarUsuario(credenciales);
    if (usuario) {
      let codigo2fa = this.servicioSeguridad.crearTextoAleatorio(5);
      console.log(codigo2fa);
      let login: Login = new Login();
      login.usuarioId = usuario._id!;
      login.codigo2fa = codigo2fa;
      login.estadoCodigo2fa = false;
      login.token = "";
      login.estadoToken = false;
      this.repositorioLogin.create(login);
      usuario.clave = "";
      // notificar al usuario vía correo o sms
      let datos = {
        correoDestino: usuario.correo,
        nombreDestino: usuario.primerNombre + " " + usuario.segundoNombre,
        contenidoCorreo: `Su código de segundo factor de autenticación es: ${codigo2fa}`,
        asuntoCorreo: ConfiguracionNotificacion.asunto2fa,
      };
      let url = ConfiguracionNotificacion.urlNotificaciones2fa;
      this.servicioNotificaciones.EnviarCorreoElectronio(datos, url);
      return usuario;
    }
    return new HttpErrors[401]("Credenciales incorrectas.");
  }

  @post('/validar-permisos')
  @response(200,{
    description:"validacion de permisos de usuario para logica de megocio",
    content:{'application/json':{schema:getModelSchemaRef(Usuario)}}
  })
  async ValidarPermisosDeUsuario(
    @requestBody(
      {
        content:{
          'application/json':{
            schema: getModelSchemaRef(Credenciales)
          }
        }
      }
      )
      credenciales: Credenciales
  ): Promise<object> {
    let usuario = await this.servicioSeguridad.identificarUsuario(credenciales);
    if (usuario) {
      let codigo2fa = this.servicioSeguridad.crearTextoAleatorio(5);
      let login:Login = new Login();
      login.usuarioId = usuario._id!;
      login.codigo2fa = codigo2fa;
      login.estadoCodigo2fa =false;
      login.token = "";
      login.estadoToken = false;
      this.repositorioLogin.create(login);
      usuario.clave = "";
      //notificar al usuario via correo o sms
      return usuario;
    }
    return new HttpErrors[401]("credenciales incorrectras.");
  }

  @post('/verificar-2fa')
  @response(200,{
    description:"validar un codigo de 2do factor de autenticacion",
    
  })
  async VerificarCodigo2fa(
    @requestBody(
      {
        content:{
          'application/json':{
            schema: getModelSchemaRef(FactorDeAutenticacionPorCodigo)
          }
        }
      }
      )
      credenciales: FactorDeAutenticacionPorCodigo
  ): Promise<object> {
    let usuario = await this.servicioSeguridad.validarCodigo2fa(credenciales);
    if(usuario){
    let token = this.servicioSeguridad.crearToken(usuario)

    if (usuario){
      usuario.clave = "";
      try{
        this.usuarioRepository.logins(usuario._id).patch({
          estadoCodigo2fa: true,
          token: token
        },
        {
          estadoCodigo2fa:false
        });
    }catch{
      console.log("no se ha almacenado el cambio de estado de token en la base de datos.")
    }
      return{
        user:usuario,
        token:token
      };
    }
  }
    return new HttpErrors[401]("Codigo de 2fa invalido para el usuario definido");
  }
    
}

use glfw::{Action, Context as _, Key, WindowEvent};
use luminance_glfw::GlfwSurface;
use luminance_windowing::{WindowDim, WindowOpt};
use std::process::exit;
use luminance::context::GraphicsContext as _;
use luminance::pipeline::PipelineState;
use std::time::Instant;

use luminance_derive::{Semantics, Vertex};

use luminance::tess::Mode;

use luminance::shader::Program;
use luminance::render_state::RenderState;

const VS_STR: &str = include_str!("vs.glsl");
const FS_STR: &str = include_str!("fs.glsl");

#[derive(Copy, Clone, Debug, Semantics)]
pub enum VertexSemantics {
  #[sem(name = "position", repr = "[f32; 2]", wrapper = "VertexPosition")]
  Position,
  #[sem(name = "color", repr = "[u8; 3]", wrapper = "VertexRGB")]
  Color,
}

#[derive(Vertex, Copy, Clone)]
#[vertex(sem = "VertexSemantics")]
pub struct Vertex {
  #[allow(dead_code)]
  position: VertexPosition,

  #[allow(dead_code)]
  #[vertex(normalized = "true")]
  color: VertexRGB,
}

const VERTICES: [Vertex; 3] = [
  Vertex::new(
    VertexPosition::new([-0.5, -0.5]),
    VertexRGB::new([255, 0, 0]),
  ),
  Vertex::new(
    VertexPosition::new([0.5, -0.5]),
    VertexRGB::new([0, 255, 0]),
  ),
  Vertex::new(
    VertexPosition::new([0., 0.5]),
    VertexRGB::new([0, 0, 255])
  ),
];

fn main() {
  // our graphics surface
  let dim = WindowDim::Windowed {
    width: 960,
    height: 540,
  };
  let surface = GlfwSurface::new_gl33("Hello, world!", WindowOpt::default().set_dim(dim));

  match surface {
    Ok(surface) => {
      eprintln!("graphics surface created");
      main_loop(surface);
    }
    Err(e) => {
      eprintln!("cannot create graphics surface:\n{}", e);
      exit(1);
    }
  }
}

fn main_loop(mut surface: GlfwSurface) {
  let start_t = Instant::now();
  let mut ctxt = surface.context;
  let events = surface.events_rx;
  let back_buffer = ctxt.back_buffer().expect("back buffer");

  let triangle = ctxt
    .new_tess()
    .set_vertices(&VERTICES[..])
    .set_mode(Mode::Triangle)
    .build()
    .unwrap();

  
  let mut program = ctxt
    .new_shader_program::<VertexSemantics, (), ()>()
    .from_strings(VS_STR, None, None, FS_STR)
    .unwrap()
    .ignore_warnings();

  'app: loop {
    // handle events
    ctxt.window.glfw.poll_events();
    for (_, event) in glfw::flush_messages(&events) {
      match event {
        WindowEvent::Close | WindowEvent::Key(Key::Escape, _, Action::Release, _) => break 'app,
        _ => (),
      }
    }
    // rendering code goes here
    let t = start_t.elapsed().as_secs_f32();
    let color = [t.cos(), t.sin(), 0.5, 1.];

    let render = ctxt
      .new_pipeline_gate()
      .pipeline(
        &back_buffer,
        &PipelineState::default().set_clear_color(color),
        |_, mut shd_gate| {
          shd_gate.shade(&mut program, |_, _, mut rdr_gate| {
            rdr_gate.render(&RenderState::default(), |mut tess_gate| {
              tess_gate.render(&triangle)
            })
          })
        },
      )
      .assume();

    // swap buffer chains
    if render.is_ok() {
      ctxt.window.swap_buffers();
    } else {
      break 'app;
    }
  }
}

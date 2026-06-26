#![no_std]

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

const HEADER_SIZE: u32 = 80;
const COUNT_SIZE: u32 = 4;
const TRIANGLE_SIZE: u32 = 50;

#[no_mangle]
pub extern "C" fn stl_binary_size(float_count: u32) -> u32 {
    HEADER_SIZE + COUNT_SIZE + (float_count / 9) * TRIANGLE_SIZE
}

#[no_mangle]
pub unsafe extern "C" fn write_stl_binary(
    positions_ptr: *const f32,
    float_count: u32,
    out_ptr: *mut u8,
    out_len: u32,
) -> u32 {
    let triangle_count = float_count / 9;
    let required = HEADER_SIZE + COUNT_SIZE + triangle_count * TRIANGLE_SIZE;
    if out_len < required {
        return 0;
    }

    for i in 0..HEADER_SIZE {
        *out_ptr.add(i as usize) = 0;
    }
    write_u32_le(out_ptr.add(HEADER_SIZE as usize), triangle_count);

    let mut dst = (HEADER_SIZE + COUNT_SIZE) as usize;
    let mut src = 0usize;
    for _ in 0..triangle_count {
        let ax = *positions_ptr.add(src);
        let ay = *positions_ptr.add(src + 1);
        let az = *positions_ptr.add(src + 2);
        let bx = *positions_ptr.add(src + 3);
        let by = *positions_ptr.add(src + 4);
        let bz = *positions_ptr.add(src + 5);
        let cx = *positions_ptr.add(src + 6);
        let cy = *positions_ptr.add(src + 7);
        let cz = *positions_ptr.add(src + 8);
        src += 9;

        let cbx = cx - bx;
        let cby = cy - by;
        let cbz = cz - bz;
        let abx = ax - bx;
        let aby = ay - by;
        let abz = az - bz;
        let mut nx = cby * abz - cbz * aby;
        let mut ny = cbz * abx - cbx * abz;
        let mut nz = cbx * aby - cby * abx;
        let len = sqrt(nx * nx + ny * ny + nz * nz);
        if len > 0.0 {
            nx /= len;
            ny /= len;
            nz /= len;
        }

        let tri = out_ptr.add(dst);
        write_f32_le(tri, nx);
        write_f32_le(tri.add(4), ny);
        write_f32_le(tri.add(8), nz);
        write_f32_le(tri.add(12), ax);
        write_f32_le(tri.add(16), ay);
        write_f32_le(tri.add(20), az);
        write_f32_le(tri.add(24), bx);
        write_f32_le(tri.add(28), by);
        write_f32_le(tri.add(32), bz);
        write_f32_le(tri.add(36), cx);
        write_f32_le(tri.add(40), cy);
        write_f32_le(tri.add(44), cz);
        write_u16_le(tri.add(48), 0);
        dst += TRIANGLE_SIZE as usize;
    }

    required
}

unsafe fn write_u16_le(ptr: *mut u8, value: u16) {
    let bytes = value.to_le_bytes();
    *ptr = bytes[0];
    *ptr.add(1) = bytes[1];
}

unsafe fn write_u32_le(ptr: *mut u8, value: u32) {
    let bytes = value.to_le_bytes();
    *ptr = bytes[0];
    *ptr.add(1) = bytes[1];
    *ptr.add(2) = bytes[2];
    *ptr.add(3) = bytes[3];
}

unsafe fn write_f32_le(ptr: *mut u8, value: f32) {
    let bytes = value.to_bits().to_le_bytes();
    *ptr = bytes[0];
    *ptr.add(1) = bytes[1];
    *ptr.add(2) = bytes[2];
    *ptr.add(3) = bytes[3];
}

fn sqrt(value: f32) -> f32 {
    if value <= 0.0 {
        return 0.0;
    }
    let mut x = if value > 1.0 { value } else { 1.0 };
    for _ in 0..8 {
        x = 0.5 * (x + value / x);
    }
    x
}

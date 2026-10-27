/**
 * 三类地质环境 —— 同一底座下的板块结构
 * 依据：handoff/plans/TASK-001.md §5.3「三类地质环境」
 *
 * 规则：
 *   1. 三者的下部结构必须**一眼可分**：俯冲是倾斜板片、洋中是分离的缝、热点是板内热柱。
 *   2. 不把所有火山成因画成同一种俯冲。
 *   3. 每套环境都配 3D 方向箭头，HTML 侧另有文字说明。
 */

import * as THREE from 'three';
import { readScenePalette, BASE_Y } from './terrain.js';

/** 构造一个方向箭头（圆柱杆 + 圆锥头），避免 1px 细线在暗背景里看不见。 */
function makeArrow(dir, length, color, thickness = 0.055) {
  const g = new THREE.Group();
  const d = dir.clone().normalize();
  const headLen = Math.min(0.42, length * 0.38);
  const shaftLen = Math.max(0.05, length - headLen);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(thickness, thickness, shaftLen, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 })
  );
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(thickness * 2.6, headLen, 14),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      roughness: 0.5,
      metalness: 0.1,
    })
  );

  // 圆柱默认沿 +Y，转到 d 方向
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  shaft.quaternion.copy(q);
  head.quaternion.copy(q);

  const mid = shaftLen / 2;
  const headMid = shaftLen + headLen / 2;
  shaft.position.copy(d).multiplyScalar(mid);
  head.position.copy(d).multiplyScalar(headMid);

  g.add(shaft, head);
  return g;
}

/** 板块盒体（带轻微倒角的视觉效果由粗糙度表达）。 */
function makeSlab(size, position, color, rotZ = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.04 })
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.z = rotZ;
  return mesh;
}

/**
 * 构建某一种地质环境。
 * @param {'divergent'|'subduction'|'hotspot'} context
 * @returns {THREE.Group}
 */
export function buildTectonicContext(context) {
  const palette = readScenePalette();
  const group = new THREE.Group();
  group.name = `tectonics-${context}`;

  const plate = palette.plate.clone().lerp(palette.rock, 0.42).multiplyScalar(0.72);
  const molten = palette.magma.clone();

  if (context === 'subduction') {
    // 洋侧板片由海面 (-x) 向深处 (+x) 俯冲；陆侧板片水平
    const slab = makeSlab([3.2, 0.2, 2.8], [-1.5, -1.3, 0], plate, -0.42);
    slab.name = 'subducting-slab';
    group.add(slab);

    const continental = makeSlab([3.0, 0.2, 2.8], [2.3, -1.15, 0], plate.clone().lerp(palette.rock, 0.25));
    continental.name = 'continental-plate';
    group.add(continental);

    // 上覆地幔中的部分熔融楔
    const wedge = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 20, 14),
      new THREE.MeshStandardMaterial({
        color: molten,
        emissive: molten,
        emissiveIntensity: 0.5,
        roughness: 0.6,
      })
    );
    wedge.scale.set(0.78, 0.5, 1.0);
    wedge.position.set(-0.05, -1.95, 0);
    wedge.name = 'partial-melting';
    group.add(wedge);

    const arrow = makeArrow(new THREE.Vector3(0.92, -0.4, 0), 1.1, palette.aerosol);
    arrow.position.set(-1.25, -0.72, 0);
    arrow.name = 'subduction-arrow';
    group.add(arrow);

    const up = makeArrow(new THREE.Vector3(0, 1, 0), 0.8, molten);
    up.position.set(-0.05, -1.6, 0);
    up.name = 'melting-arrow';
    group.add(up);
  } else if (context === 'divergent') {
    // 两块板片分离，中间 0.8 的缝
    const left = makeSlab([3.2, 0.26, 3.0], [-1.95, -1.0, 0], plate.clone().lerp(palette.rock, 0.2));
    left.name = 'plate-left';
    const right = makeSlab([3.2, 0.26, 3.0], [1.95, -1.0, 0], plate.clone().lerp(palette.rock, 0.2));
    right.name = 'plate-right';
    group.add(left, right);

    // 中央薄上涌体
    const upwell = makeSlab([0.62, 1.2, 2.0], [0, -1.6, 0], molten.clone().lerp(palette.strata, 0.25));
    upwell.material = new THREE.MeshStandardMaterial({
      color: molten,
      emissive: molten,
      emissiveIntensity: 0.42,
      roughness: 0.7,
    });
    upwell.name = 'upwelling';
    group.add(upwell);

    const arrowL = makeArrow(new THREE.Vector3(-1, 0, 0), 1.0, palette.aerosol);
    arrowL.position.set(-1.1, -0.62, 0);
    arrowL.name = 'diverge-arrow-left';
    const arrowR = makeArrow(new THREE.Vector3(1, 0, 0), 1.0, palette.aerosol);
    arrowR.position.set(1.1, -0.62, 0);
    arrowR.name = 'diverge-arrow-right';
    group.add(arrowL, arrowR);
  } else {
    // 热点：完整水平板片 + 板内细长热柱
    const plateFull = makeSlab([5.6, 0.24, 3.0], [0, -1.05, 0], plate.clone().lerp(palette.rock, 0.25));
    plateFull.name = 'intraplate';
    group.add(plateFull);

    const column = makeSlab([0.72, 1.2, 0.72], [0, -1.65, 0], molten.clone());
    column.material = new THREE.MeshStandardMaterial({
      color: molten,
      emissive: molten,
      emissiveIntensity: 0.55,
      roughness: 0.65,
    });
    column.name = 'mantle-plume';
    group.add(column);

    const up = makeArrow(new THREE.Vector3(0, 1, 0), 1.2, molten);
    up.position.set(0, -1.2, 0);
    up.name = 'plume-arrow';
    group.add(up);
  }

  // 底面封板，避免从下方看穿帮
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.1, 3.6),
    new THREE.MeshStandardMaterial({ color: palette.rock.clone().multiplyScalar(0.5), roughness: 0.95 })
  );
  floor.position.set(0, BASE_Y + 0.05, 0);
  floor.name = 'tectonic-floor';
  group.add(floor);

  group.userData.dispose = () => {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  };

  return group;
}

/**
 * characterAvatarBuilder.ts
 * Constructor procedural Three.js compartido para los 8 personajes oficiales de Commonspoly
 * y los Especuladores. Garantiza coherencia exacta entre el tablero 3D y el selector del Setup.
 */

import * as THREE from 'three';
import { markAsSecondaryDetail } from './frustumCulling';

export function disposeAvatarGroup(group: THREE.Group): void {
  if (group.parent) {
    group.parent.remove(group);
  }
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material?.dispose();
      }
    }
  });
}

function addShadowDisc(group: THREE.Group, includeShadow: boolean, isLowPoly: boolean): void {
  if (!includeShadow) return;
  const shadowGeo = new THREE.CircleGeometry(0.46, isLowPoly ? 10 : 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  markAsSecondaryDetail(shadow);
  group.add(shadow);
}

/**
 * Construye una miniatura procedural multi-parte (6–9 piezas) anclada en y = 0.
 * Soporta `detail: 'board'` para reducir drásticamente el poligonaje en móviles antiguos.
 */
export function createCharacterPawnMesh(
  charId: string,
  colorHex: string,
  accentColorHex = '#1e293b',
  isSpeculator = false,
  options: { includeShadowDisc?: boolean; detail?: 'high' | 'board' } = {}
): THREE.Group {
  const { includeShadowDisc = true, detail = 'high' } = options;
  const isBoard = detail === 'board';

  // Segmentación adaptativa para optimizar triángulos por peón en el tablero
  const cylSeg = isBoard ? 10 : 24;
  const baseSeg = isBoard ? 12 : 28;
  const sphereW = isBoard ? 10 : 24;
  const sphereH = isBoard ? 8 : 24;
  const torusRad = isBoard ? 5 : 10;
  const torusTub = isBoard ? 10 : 24;
  const accSeg = isBoard ? 8 : 16;

  const group = new THREE.Group();
  const normalizedId = charId.toLowerCase();

  const primaryColor = new THREE.Color(colorHex);
  const accentColor = new THREE.Color(accentColorHex);

  // Materiales PBR diferenciados (contraste real de roughness >= 0.25)
  const baseMat = new THREE.MeshStandardMaterial({
    color: isSpeculator ? new THREE.Color(colorHex) : accentColor,
    roughness: 0.28,
    metalness: isSpeculator ? 0.72 : 0.35
  });

  const bodyMat = new THREE.MeshStandardMaterial({
    color: isSpeculator ? new THREE.Color(0x1e293b) : primaryColor,
    roughness: 0.58,
    metalness: isSpeculator ? 0.35 : 0.08
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: isSpeculator ? new THREE.Color(0x334155) : primaryColor.clone().lerp(new THREE.Color(0xffffff), 0.14),
    roughness: 0.42,
    metalness: 0.12
  });

  const metalTrimMat = new THREE.MeshStandardMaterial({
    color: isSpeculator ? 0xe2e8f0 : 0xfacc15,
    roughness: 0.18,
    metalness: 0.85
  });

  const clothMat = new THREE.MeshStandardMaterial({
    color: accentColor.clone().lerp(new THREE.Color(0xffffff), 0.2),
    roughness: 0.76,
    metalness: 0.04
  });

  const darkAccessoryMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.32,
    metalness: 0.25
  });

  const lightAccessoryMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.68,
    metalness: 0.05
  });

  // 1. Pedestal escalonado (anclado en y = 0)
  const baseBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.44, 0.11, baseSeg),
    baseMat
  );
  baseBottom.position.y = 0.055;
  baseBottom.castShadow = true;
  baseBottom.receiveShadow = true;
  group.add(baseBottom);

  const baseRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.37, 0.07, baseSeg),
    metalTrimMat
  );
  baseRim.position.y = 0.14;
  baseRim.castShadow = !isBoard;
  markAsSecondaryDetail(baseRim);
  group.add(baseRim);

  // 2. Torso base (adaptado ligeramente según silueta)
  const torsoTopR = normalizedId === 'carolina' || normalizedId === 'whina' ? 0.17 : 0.19;
  const torsoBotR = normalizedId === 'carolina' ? 0.34 : 0.29;
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoTopR, torsoBotR, 0.54, cylSeg),
    bodyMat
  );
  torso.position.y = 0.44;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // 3. Collar / Anillo de unión (detalle secundario)
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.036, torusRad, torusTub),
    metalTrimMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.72;
  markAsSecondaryDetail(collar);
  group.add(collar);

  // 4. Cabeza
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, sphereW, sphereH),
    headMat
  );
  head.position.y = 0.93;
  head.castShadow = true;
  group.add(head);

  // 5. Especulador vs. Rasgos únicos de los 8 personajes oficiales
  if (isSpeculator) {
    // Sombrero de copa clásico + banda dorada + monóculo
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.22,
      metalness: 0.3
    });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.035, cylSeg), hatMat);
    brim.position.y = 1.13;
    brim.castShadow = !isBoard;
    group.add(brim);

    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.055, cylSeg), metalTrimMat);
    hatBand.position.y = 1.175;
    markAsSecondaryDetail(hatBand);
    group.add(hatBand);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.31, cylSeg), hatMat);
    crown.position.y = 1.33;
    crown.castShadow = true;
    group.add(crown);

    const monocle = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.014, isBoard ? 4 : 10, isBoard ? 8 : 18),
      metalTrimMat
    );
    monocle.position.set(0.085, 0.96, 0.2);
    markAsSecondaryDetail(monocle);
    group.add(monocle);
  } else {
    switch (normalizedId) {
      case 'carolina': {
        // Delantal solidario + moño trenzado + insignia de cruz de cuidados
        const apron = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.31, 0.42, accSeg, 1, false, -0.75, 1.5),
          lightAccessoryMat
        );
        apron.position.set(0, 0.41, 0.03);
        group.add(apron);

        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.03), baseMat);
        crossV.position.set(0, 0.54, 0.24);
        markAsSecondaryDetail(crossV);
        group.add(crossV);

        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.03), baseMat);
        crossH.position.set(0, 0.54, 0.24);
        markAsSecondaryDetail(crossH);
        group.add(crossH);

        const bun = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, isBoard ? 7 : 16, isBoard ? 6 : 16),
          darkAccessoryMat
        );
        bun.position.set(0, 0.96, -0.21);
        bun.castShadow = !isBoard;
        group.add(bun);

        const headscarf = new THREE.Mesh(
          new THREE.TorusGeometry(0.195, 0.03, torusRad, isBoard ? 10 : 22),
          clothMat
        );
        headscarf.rotation.x = Math.PI / 2 - 0.25;
        headscarf.position.set(0, 1.03, -0.02);
        markAsSecondaryDetail(headscarf);
        group.add(headscarf);
        break;
      }

      case 'chelsea': {
        // Melena asimétrica + visor/gafas de ciberseguridad cian brillante + hombrera técnica
        const visorMat = new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x0891b2,
          emissiveIntensity: 0.65,
          roughness: 0.15,
          metalness: 0.6
        });

        const hairCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.228, isBoard ? 10 : 20, isBoard ? 7 : 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
          darkAccessoryMat
        );
        hairCap.position.set(0, 0.945, -0.01);
        hairCap.rotation.x = -0.2;
        group.add(hairCap);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.075, 0.07), visorMat);
        visor.position.set(0, 0.955, 0.195);
        group.add(visor);

        const visorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.03), darkAccessoryMat);
        visorFrame.position.set(0, 0.955, 0.175);
        markAsSecondaryDetail(visorFrame);
        group.add(visorFrame);

        const techPack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.08), darkAccessoryMat);
        techPack.position.set(0, 0.5, -0.23);
        markAsSecondaryDetail(techPack);
        group.add(techPack);
        break;
      }

      case 'matsuko': {
        // Capa teatral trasera + hombreras doradas + corona/cresta escénica
        const cape = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.42, 0.58, isBoard ? 8 : 18, 1, false, Math.PI * 0.65, Math.PI * 0.7),
          clothMat
        );
        cape.position.set(0, 0.44, -0.04);
        cape.castShadow = !isBoard;
        group.add(cape);

        const pauldronGeo = new THREE.SphereGeometry(0.08, isBoard ? 6 : 12, isBoard ? 5 : 12);
        const pauldronL = new THREE.Mesh(pauldronGeo, metalTrimMat);
        pauldronL.position.set(-0.21, 0.69, 0);
        markAsSecondaryDetail(pauldronL);
        group.add(pauldronL);

        const pauldronR = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, isBoard ? 6 : 12, isBoard ? 5 : 12),
          metalTrimMat
        );
        pauldronR.position.set(0.21, 0.69, 0);
        markAsSecondaryDetail(pauldronR);
        group.add(pauldronR);

        const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.12, 6), metalTrimMat);
        crownRing.position.set(0, 1.15, 0);
        crownRing.castShadow = !isBoard;
        group.add(crownRing);

        const brooch = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), metalTrimMat);
        brooch.position.set(0, 0.6, 0.22);
        markAsSecondaryDetail(brooch);
        group.add(brooch);
        break;
      }

      case 'moha': {
        // Gorra urbana con visera + megáfono de activismo callejero
        const capMat = new THREE.MeshStandardMaterial({
          color: 0xfb923c,
          roughness: 0.45,
          metalness: 0.1
        });
        const capDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.225, isBoard ? 10 : 20, isBoard ? 7 : 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
          capMat
        );
        capDome.position.set(0, 0.96, 0);
        group.add(capDome);

        const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.17), darkAccessoryMat);
        capBrim.position.set(0, 1.01, 0.2);
        capBrim.rotation.x = 0.14;
        group.add(capBrim);

        // Megáfono en el lado derecho
        const megaphoneCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.11, 0.24, accSeg, 1, true),
          lightAccessoryMat
        );
        megaphoneCone.rotation.x = Math.PI / 2;
        megaphoneCone.rotation.z = -0.25;
        megaphoneCone.position.set(0.27, 0.67, 0.14);
        group.add(megaphoneCone);

        const megaphoneHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), darkAccessoryMat);
        megaphoneHandle.position.set(0.24, 0.58, 0.07);
        markAsSecondaryDetail(megaphoneHandle);
        group.add(megaphoneHandle);
        break;
      }

      case 'prafulla': {
        // Gorro alto de cocinero (toque) + fajín dorado + cuchara/espátula solidaria
        const toqueBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.16, cylSeg), lightAccessoryMat);
        toqueBase.position.set(0, 1.15, 0);
        toqueBase.castShadow = !isBoard;
        group.add(toqueBase);

        const toquePuff = new THREE.Mesh(
          new THREE.SphereGeometry(0.21, isBoard ? 10 : 18, isBoard ? 7 : 16),
          lightAccessoryMat
        );
        toquePuff.scale.set(1, 0.72, 1);
        toquePuff.position.set(0, 1.25, 0);
        toquePuff.castShadow = true;
        group.add(toquePuff);

        const sash = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.035, torusRad, torusTub), metalTrimMat);
        sash.rotation.x = Math.PI / 2;
        sash.position.set(0, 0.37, 0);
        markAsSecondaryDetail(sash);
        group.add(sash);

        const ladleStem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.42, isBoard ? 5 : 10),
          clothMat
        );
        ladleStem.rotation.z = 0.28;
        ladleStem.position.set(-0.27, 0.56, 0.08);
        markAsSecondaryDetail(ladleStem);
        group.add(ladleStem);
        break;
      }

      case 'temple': {
        // Chaleco de campo + bandolera cruzada + prismáticos de observación
        const satchelStrap = new THREE.Mesh(
          new THREE.TorusGeometry(0.24, 0.025, torusRad, torusTub),
          darkAccessoryMat
        );
        satchelStrap.rotation.y = Math.PI / 3;
        satchelStrap.rotation.x = Math.PI / 4;
        satchelStrap.position.set(0, 0.49, 0);
        markAsSecondaryDetail(satchelStrap);
        group.add(satchelStrap);

        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.09), clothMat);
        pouch.position.set(0.25, 0.36, 0.1);
        markAsSecondaryDetail(pouch);
        group.add(pouch);

        const binoSeg = isBoard ? 6 : 12;
        const binoL = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.11, binoSeg), darkAccessoryMat);
        binoL.rotation.x = Math.PI / 2;
        binoL.position.set(-0.048, 0.62, 0.22);
        markAsSecondaryDetail(binoL);
        group.add(binoL);

        const binoR = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.11, binoSeg), darkAccessoryMat);
        binoR.rotation.x = Math.PI / 2;
        binoR.position.set(0.048, 0.62, 0.22);
        markAsSecondaryDetail(binoR);
        group.add(binoR);

        const headband = new THREE.Mesh(
          new THREE.TorusGeometry(0.205, 0.022, torusRad, torusTub),
          lightAccessoryMat
        );
        headband.rotation.x = Math.PI / 2 - 0.18;
        headband.position.set(0, 1.0, 0);
        group.add(headband);
        break;
      }

      case 'whina': {
        // Cinta tejida ancestral + pluma ceremonial turquesa/oro + estola tejida
        const wovenStole = new THREE.Mesh(
          new THREE.TorusGeometry(0.22, 0.042, torusRad, torusTub),
          lightAccessoryMat
        );
        wovenStole.rotation.x = Math.PI / 2 + 0.15;
        wovenStole.position.set(0, 0.66, 0);
        group.add(wovenStole);

        const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.065, cylSeg), clothMat);
        headband.position.set(0, 1.01, 0);
        group.add(headband);

        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, isBoard ? 5 : 8), metalTrimMat);
        feather.scale.set(0.55, 1, 1);
        feather.rotation.z = -0.35;
        feather.rotation.x = -0.15;
        feather.position.set(0.18, 1.18, -0.05);
        feather.castShadow = !isBoard;
        group.add(feather);

        const backBun = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, isBoard ? 6 : 14, isBoard ? 5 : 14),
          darkAccessoryMat
        );
        backBun.position.set(0, 0.94, -0.21);
        markAsSecondaryDetail(backBun);
        group.add(backBun);
        break;
      }

      case 'yayo': {
        // Moño plateado de profesora + broche y corona botánica de doble hoja ecofeminista
        const silverHairMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.5,
          metalness: 0.15
        });
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x34d399,
          roughness: 0.35,
          metalness: 0.12
        });

        const silverBun = new THREE.Mesh(
          new THREE.SphereGeometry(0.115, isBoard ? 7 : 16, isBoard ? 6 : 16),
          silverHairMat
        );
        silverBun.position.set(0, 0.96, -0.21);
        silverBun.castShadow = !isBoard;
        group.add(silverBun);

        const glassRad = isBoard ? 4 : 8;
        const glassTub = isBoard ? 8 : 16;
        const glasses = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, glassRad, glassTub), metalTrimMat);
        glasses.position.set(-0.065, 0.95, 0.205);
        markAsSecondaryDetail(glasses);
        group.add(glasses);

        const glasses2 = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, glassRad, glassTub), metalTrimMat);
        glasses2.position.set(0.065, 0.95, 0.205);
        markAsSecondaryDetail(glasses2);
        group.add(glasses2);

        const leafSeg = isBoard ? 6 : 12;
        const leafL = new THREE.Mesh(new THREE.SphereGeometry(0.095, leafSeg, leafSeg), leafMat);
        leafL.scale.set(0.55, 1.3, 0.3);
        leafL.rotation.z = 0.55;
        leafL.position.set(-0.08, 1.17, 0.02);
        group.add(leafL);

        const leafR = new THREE.Mesh(new THREE.SphereGeometry(0.095, leafSeg, leafSeg), leafMat);
        leafR.scale.set(0.55, 1.3, 0.3);
        leafR.rotation.z = -0.55;
        leafR.position.set(0.08, 1.17, 0.02);
        group.add(leafR);
        break;
      }

      default: {
        // Insignia genérica
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), metalTrimMat);
        gem.position.set(0, 1.18, 0);
        markAsSecondaryDetail(gem);
        group.add(gem);
        break;
      }
    }
  }

  addShadowDisc(group, includeShadowDisc, isBoard);
  return group;
}

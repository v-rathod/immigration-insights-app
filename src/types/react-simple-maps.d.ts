declare module "react-simple-maps" {
  import { ComponentType, CSSProperties, ReactNode } from "react";

  interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }

  interface GeographyStyleMap {
    default?: CSSProperties;
    hover?: CSSProperties & { cursor?: string };
    pressed?: CSSProperties;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type GeoType = any;

  interface GeographyProps {
    geography: GeoType;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: GeographyStyleMap;
    onMouseEnter?: (event: React.MouseEvent) => void;
    onMouseMove?: (event: React.MouseEvent) => void;
    onMouseLeave?: (event: React.MouseEvent) => void;
    onClick?: (event: React.MouseEvent) => void;
  }

  interface GeographiesChildArgs {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geographies: any[];
  }

  interface GeographiesProps {
    geography: string | object;
    children: (args: GeographiesChildArgs) => ReactNode;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const ZoomableGroup: ComponentType<{
    center?: [number, number];
    zoom?: number;
    children?: ReactNode;
  }>;
  export const Marker: ComponentType<{
    coordinates: [number, number];
    children?: ReactNode;
  }>;
  export const Line: ComponentType<{
    from: [number, number];
    to: [number, number];
    stroke?: string;
    strokeWidth?: number;
  }>;
  export const Annotation: ComponentType<{
    subject: [number, number];
    dx?: number;
    dy?: number;
    children?: ReactNode;
  }>;
  export const Graticule: ComponentType<{
    stroke?: string;
    strokeWidth?: number;
  }>;
}

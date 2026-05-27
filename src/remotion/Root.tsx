import React from "react";
import { Composition } from "remotion";
import { DocToEpub } from "./DocToEpub";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DocToEpub"
      component={DocToEpub}
      durationInFrames={96}
      fps={30}
      width={720}
      height={720}
    />
  );
};

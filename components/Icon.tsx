import React from 'react';
import { ICONS } from '../constants';

export type IconName = keyof typeof ICONS;

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, ...props }) => {
  const pathData = ICONS[name];

  if (!pathData) {
    console.warn(`Icon "${name}" not found.`);
    return null;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      dangerouslySetInnerHTML={{ __html: pathData }}
    />
  );
};

export default Icon;

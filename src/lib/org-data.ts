export type Employee = {
  id:string; name:string; initials:string; title:string; department:string; location:string;
  email:string; phone:string; status:"Present"|"Remote"|"Away"; managerId?:string; reports:string[];
};

export const employees:Record<string,Employee> = {
 "aditi-rao":{id:"aditi-rao",name:"Aditi Rao",initials:"AR",title:"Chief Executive Officer",department:"Executive",location:"Bengaluru",email:"aditi.rao@acme.example",phone:"+91 80 4123 1001",status:"Present",reports:["tarun-khanna","meera-sen","nina-shah"]},
 "tarun-khanna":{id:"tarun-khanna",name:"Tarun Khanna",initials:"TK",title:"VP, Technology & Product",department:"Technology",location:"Bengaluru",email:"tarun.khanna@acme.example",phone:"+91 80 4123 1022",status:"Present",managerId:"aditi-rao",reports:["vikas-tiwari","rohan-kapoor"]},
 "vikas-tiwari":{id:"vikas-tiwari",name:"Vikas Tiwari",initials:"VT",title:"Product Lead",department:"Product",location:"Bengaluru",email:"vikas.tiwari@acme.example",phone:"+91 98 2214 7710",status:"Present",managerId:"tarun-khanna",reports:["aisha-mehta","mira-joseph"]},
 "aisha-mehta":{id:"aisha-mehta",name:"Aisha Mehta",initials:"AM",title:"Lead Product Designer",department:"Design",location:"Bengaluru",email:"aisha.mehta@acme.example",phone:"+91 98 2001 4420",status:"Remote",managerId:"vikas-tiwari",reports:[]},
 "mira-joseph":{id:"mira-joseph",name:"Mira Joseph",initials:"MJ",title:"Product Analyst",department:"Product",location:"Pune",email:"mira.joseph@acme.example",phone:"+91 98 2001 4431",status:"Present",managerId:"vikas-tiwari",reports:[]},
 "rohan-kapoor":{id:"rohan-kapoor",name:"Rohan Kapoor",initials:"RK",title:"Engineering Director",department:"Engineering",location:"Pune",email:"rohan.kapoor@acme.example",phone:"+91 20 4421 7740",status:"Remote",managerId:"tarun-khanna",reports:["neel-desai","kavya-menon"]},
 "neel-desai":{id:"neel-desai",name:"Neel Desai",initials:"ND",title:"Senior Backend Engineer",department:"Engineering",location:"Pune",email:"neel.desai@acme.example",phone:"+91 98 2774 5102",status:"Present",managerId:"rohan-kapoor",reports:[]},
 "kavya-menon":{id:"kavya-menon",name:"Kavya Menon",initials:"KM",title:"Engineering Manager",department:"Engineering",location:"Hyderabad",email:"kavya.menon@acme.example",phone:"+91 98 2774 5116",status:"Away",managerId:"rohan-kapoor",reports:[]},
 "meera-sen":{id:"meera-sen",name:"Meera Sen",initials:"MS",title:"Chief Revenue Officer",department:"Go to Market",location:"Mumbai",email:"meera.sen@acme.example",phone:"+91 22 4410 1830",status:"Present",managerId:"aditi-rao",reports:["arjun-bose","sara-jacob"]},
 "arjun-bose":{id:"arjun-bose",name:"Arjun Bose",initials:"AB",title:"Regional Sales Director",department:"Sales",location:"Mumbai",email:"arjun.bose@acme.example",phone:"+91 98 3012 6614",status:"Present",managerId:"meera-sen",reports:[]},
 "sara-jacob":{id:"sara-jacob",name:"Sara Jacob",initials:"SJ",title:"Customer Success Lead",department:"Customer Success",location:"Chennai",email:"sara.jacob@acme.example",phone:"+91 98 3012 6622",status:"Remote",managerId:"meera-sen",reports:[]},
 "nina-shah":{id:"nina-shah",name:"Nina Shah",initials:"NS",title:"Chief People Officer",department:"People",location:"Bengaluru",email:"nina.shah@acme.example",phone:"+91 80 4123 1098",status:"Present",managerId:"aditi-rao",reports:["priya-nair"]},
 "priya-nair":{id:"priya-nair",name:"Priya Nair",initials:"PN",title:"People Partner",department:"People",location:"Bengaluru",email:"priya.nair@acme.example",phone:"+91 98 7112 0391",status:"Present",managerId:"nina-shah",reports:[]}
};
export const rootEmployeeId="aditi-rao";

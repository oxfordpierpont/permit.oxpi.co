/* Asset replacement only: Claude's learning engine remains untouched. */
SIGNS.forEach(sign=>{
  const src='./public/assets/official-sign-catalog/'+sign.id+'.png';
  sign.s='<img class="real-sign" src="'+src+'" alt="'+sign.n+' road sign">';
});
go('home');
